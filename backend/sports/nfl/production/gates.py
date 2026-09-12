"""No status promotion from display labels or incomplete evidence."""
import json
from pathlib import Path
from ..distributions import finite

VERSION='NFL_PRODUCTION_GATE_V1'

def policy():
    value=json.loads(Path(__file__).with_name('policy.json').read_text())
    if value.get('version')!=VERSION:raise ValueError('Unknown production gate version')
    return value

def eligible(evidence,rules=None):
    rules=rules or policy();reasons=[]
    point=evidence.get('pointStatus','NOT_AVAILABLE');dist=evidence.get('distributionStatus','NOT_AVAILABLE')
    if point=='DISABLED' or dist=='DISABLED':return {'productionStatus':'DISABLED','reasons':['A required component is disabled'],'gateVersion':VERSION}
    if point=='NOT_AVAILABLE' or dist=='NOT_AVAILABLE':return {'productionStatus':'DISABLED','reasons':['Required model component unavailable'],'gateVersion':VERSION}
    for name in ('pointStatus','distributionStatus','calibrationStatus'):
        if evidence.get(name)!='VALIDATED':reasons.append(name+' is not VALIDATED')
    for field,minimum in (('screenSample',rules['minimumScreenSample']),('holdoutSample',rules['minimumHoldoutSample']),
                          ('forwardSample',rules['minimumForwardSample']),('forwardWeeks',rules['minimumForwardWeeks']),
                          ('historicalSeasons',rules['minimumHistoricalSeasons']),('lineCalibrationSample',rules['minimumLineCalibrationSample']),
                          ('lineCalibrationHoldout',rules['minimumLineCalibrationHoldout'])):
        v=evidence.get(field)
        if not finite(v) or v<minimum:reasons.append(field+' below required evidence')
    for flag in ('asOfSnapshots','untouchedHoldout','distributionBaselineImproved','sharpnessBaselineVerified','stabilityVerified','realTimestampedLines','calibrationBaselineImproved','forwardCapturedBeforeKickoff'):
        if evidence.get(flag) is not True:reasons.append(flag+' not verified')
    improvements=evidence.get('baselineImprovements')
    if not isinstance(improvements,dict) or any(not finite(improvements.get(k)) or improvements[k]<rules['minimumMAEImprovement'] for k in ('seasonMean','recentMean','historicalEfficiency')):
        reasons.append('Meaningful baseline improvement not established')
    for field,limit in (('absoluteBiasOverMAE',rules['maximumAbsoluteBiasOverMAE']),('percentileError',rules['maximumPercentileError']),
                        ('sharpnessRelativeToBaseline',rules['maximumSharpnessRelativeToBaseline']),('ECE',rules['maximumCalibrationError']),
                        ('calibrationSlopeDeviation',rules['maximumCalibrationSlopeDeviation']),('absoluteCalibrationIntercept',rules['maximumCalibrationIntercept'])):
        v=evidence.get(field)
        if not finite(v) or v>limit:reasons.append(field+' unverified or outside gate')
    availability=evidence.get('rosterAvailability')
    if not finite(availability) or availability<rules['minimumRosterAvailability']:reasons.append('Roster availability insufficient')
    if evidence.get('health')!='HEALTHY':reasons.append('Model health is not HEALTHY')
    return {'productionStatus':'SHADOW_ONLY' if reasons else 'PRODUCTION_READY','reasons':reasons,'gateVersion':VERSION}
