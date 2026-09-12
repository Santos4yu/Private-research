"""Public NFL decisions abstain; no connected current line provider exists."""
from .audit import audit_models
from .decisions import decide,value_board

def decision(position,prop,player_id=None,game_id=None):
    model=next((m for m in audit_models()['models'] if m['position']==position and m['propType']==prop),None)
    if not model:raise ValueError('Unknown NFL position/prop')
    context={'playerId':player_id,'gameId':game_id,'propType':prop,'position':position,'pointStatus':model['pointStatus'],
             'distributionStatus':model['distributionStatus'],'calibrationStatus':model['calibrationStatus'],'modelHealth':model['health']}
    return {**decide(context,model),'modelKey':model['modelKey'],'pointStatus':model['pointStatus'],
            'distributionStatus':model['distributionStatus'],'health':model['health'],'mode':'SHADOW',
            'eligibilityReasons':model['reasons']}

def board():
    return {'status':'NOT_AVAILABLE','mode':'SHADOW','rows':value_board([]),'reason':'No production-ready model or reliable current NFL line feed.'}
