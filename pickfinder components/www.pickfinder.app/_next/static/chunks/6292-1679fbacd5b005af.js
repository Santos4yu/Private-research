"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [6292], {
        26292: function(e, t, s) {
            s.d(t, {
                kJ: function() {
                    return sg
                },
                wk: function() {
                    return sb
                },
                B5: function() {
                    return sw
                },
                L6: function() {
                    return sC
                },
                default: function() {
                    return tX
                },
                jr: function() {
                    return sr
                }
            });
            var r = s(10131),
                n = s(63210),
                a = s(55185),
                l = (0, a.memo)(function(e) {
                    var t;
                    let {
                        value: s,
                        middleThreshold: a,
                        showPercent: l,
                        subValue: i,
                        colorMode: o = "threshold"
                    } = e;
                    if (0 !== s && !s) return (0, r.jsx)("div", {
                        className: "text-xs font-normal whitespace-nowrap grid place-items-center m-auto text-gray-300 h-full bg-none",
                        children: (0, r.jsx)("h1", {
                            children: "-"
                        })
                    });
                    let d = Number(s),
                        c = l ? d <= 34 ? "from-red-600/60 to-transparent text-red-300 border-red-600" : d <= 47 ? "from-orange-600/60 to-transparent text-orange-300 border-orange-600" : d <= 52 ? "from-gray-500/60 to-transparent text-gray-300 border-gray-600" : d <= 64 ? "from-yellow-600/60 to-transparent text-yellow-300 border-yellow-600" : "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : null,
                        u = l || "threshold" !== o ? null : d > a ? "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : d < a ? "from-red-600/60 to-transparent text-red-300 border-red-600" : "from-gray-500/60 to-transparent text-gray-300 border-gray-600";
                    return (0, r.jsx)("div", {
                        className: (0, n.Z)("text-xs font-medium whitespace-nowrap w-full grid place-items-center m-auto bg-gradient-to-t border-b-2 h-full min-w-[50px] to-[90%]", null !== (t = null != c ? c : "streak" === o ? d < 0 ? "from-red-600/60 to-transparent text-red-300 border-red-600 font-bold" : d <= 1 ? "from-yellow-600/60 to-transparent text-yellow-300 border-yellow-600" : d <= 2 ? "from-lime-600/60 to-transparent text-lime-300 border-lime-600" : "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : null) && void 0 !== t ? t : u),
                        children: (0, r.jsxs)("div", {
                            className: "mt-1 flex flex-col items-center justify-center gap-0.5 leading-none",
                            children: [(0, r.jsxs)("h1", {
                                className: "leading-none",
                                children: [d, l && "%"]
                            }), i && (0, r.jsx)("span", {
                                className: "text-[9px] font-medium leading-none opacity-80",
                                children: i
                            })]
                        })
                    })
                }),
                i = s(98533),
                o = s.n(i),
                d = s(13881),
                c = s(92974),
                u = s(14713),
                m = s(71408),
                p = s(87374),
                x = s(69948),
                h = s(88773),
                f = s(6672),
                g = s(69237),
                b = s(49405),
                v = s(95738),
                j = s(1145),
                w = s(46419),
                N = s(60964),
                y = s(67362),
                k = s(46434);

            function C(e) {
                e.setHours(0, 0, 0, 0);
                let t = new Date(e);
                return t.setDate(t.getDate() + 1), {
                    utcStart: e.toUTCString(),
                    utcEnd: t.toUTCString()
                }
            }
            var M = s(51465),
                F = s(47288),
                _ = s(849),
                S = s(94300),
                R = s(87743),
                Z = s(15),
                A = s(39248),
                P = s(4695),
                L = s(37220),
                D = s(69687),
                O = s(8933),
                z = s(54586),
                I = s(28876),
                T = s(34772),
                E = s(59160),
                U = s(39094),
                V = s(70083),
                B = s(70333),
                H = s(10553),
                W = s(58334),
                G = s(18678),
                J = s(97064),
                q = s(59564),
                K = s(73249),
                X = s(63833),
                $ = s(3660),
                Q = s(67146),
                Y = s(37687),
                ee = s(52058),
                et = s(45640),
                es = s(16150),
                er = s(14032),
                en = s(58685);
            let ea = {
                all: "text-muted-foreground",
                "1-15": "text-red-500",
                "15-35": "text-orange-500",
                "35-50": "text-yellow-500",
                "50-75": "text-green-400",
                "75-80": "text-green-300",
                "80-100": "text-green-500"
            };

            function el(e) {
                let t = Math.min(99, Math.max(1, Math.round(e)));
                return t >= 80 ? "80-100" : t >= 75 ? "75-80" : t >= 50 ? "50-75" : t >= 35 ? "35-50" : t >= 15 ? "15-35" : t >= 1 ? "1-15" : "all"
            }
            let ei = {
                all: "bg-slate-500/15 text-slate-300",
                "1-15": "bg-red-500/15 text-red-300",
                "15-35": "bg-orange-500/15 text-orange-300",
                "35-50": "bg-yellow-500/15 text-yellow-300",
                "50-75": "bg-green-500/15 text-green-300",
                "75-80": "bg-green-400/15 text-green-200",
                "80-100": "bg-emerald-500/15 text-emerald-300"
            };

            function eo(e) {
                return ei[el(e)]
            }
            let ed = e => {
                let {
                    winChance: t,
                    mobile: s
                } = e, a = Math.min(99, Math.max(1, Math.round(t)));
                return (0, r.jsxs)("div", {
                    className: (0, n.Z)("inline-flex items-center text-nowrap justify-center rounded-full font-medium", ea[el(t)], s ? "border border-current bg-opacity-10 px-1.5 py-0 text-[9px] leading-4" : "border border-current bg-opacity-10 px-2.5 py-0.5 text-xs"),
                    title: "Chance the player's team wins, from sportsbook moneyline odds",
                    children: [s ? "ML " : "", a, "%"]
                })
            };
            var ec = s(34586),
                eu = s.n(ec),
                em = s(64276),
                ep = s(98842),
                ex = s(38216),
                eh = s(40122),
                ef = s(45996),
                eg = s(66961),
                eb = s(1228),
                ev = s(47068),
                ej = s(37866),
                ew = s(84003),
                eN = s(93368),
                ey = s(41915),
                ek = s(67057),
                eC = s(92676),
                eM = s(29919),
                eF = s(50555),
                e_ = s(93630),
                eS = s(97848),
                eR = s(66351),
                eZ = s(93556),
                eA = s(79772),
                eP = s(7357),
                eL = s(36098),
                eD = s(29562),
                eO = s(55904),
                ez = s(24873),
                eI = s(77606),
                eT = s(55212),
                eE = s(72044);
            let eU = ["all", "nba", "nfl", "cbb", "nhl", "cfb", "wnba", "mlb"],
                eV = "w-max min-w-[145px] whitespace-nowrap",
                eB = "w-[190px] whitespace-nowrap",
                eH = "overflow-visible",
                eW = "h-1.5 translate-y-1 p-0",
                eG = {
                    stats: [],
                    games: []
                };
            async function eJ(e) {
                let t = await fetch(e, {
                    method: "GET",
                    mode: "cors"
                });
                if (!t.ok) throw Error("An error occurred while fetching the public preview.");
                return t.json()
            }
            let eq = {
                    prizepicks: "Fixed Odds"
                },
                eK = String(0),
                eX = String(100),
                e$ = "propsFilterPresets",
                eQ = "filters",
                eY = ["pfPreset"];

            function e0(e) {
                return "object" == typeof e && null !== e && !Array.isArray(e)
            }

            function e1(e) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "";
                return "string" == typeof e ? e : t
            }

            function e5(e) {
                return Array.isArray(e) ? e.filter(e => "string" == typeof e) : []
            }

            function e2(e) {
                return Math.max(0, Math.min(100, Math.round(e)))
            }

            function e3(e) {
                let t = e1(e).trim();
                if (!t || "all" === t) return null;
                let s = t.match(/^(\d{1,3})-(\d{1,3})$/);
                if (!s) return null;
                let r = e2(Number(s[1])),
                    n = e2(Number(s[2]));
                return r > n && ([r, n] = [n, r]), [r, n]
            }

            function e4(e) {
                let t = e3(e);
                if (!t) return "";
                let [s, r] = t;
                return 0 === s && 100 === r ? "" : "".concat(s, "-").concat(r)
            }

            function e6(e) {
                return "all" === e ? "Line Filters" : "".concat(e.toUpperCase(), " Line Filters")
            }

            function e8(e, t) {
                return Array.from(e1(e).trim()).slice(0, 24).join("") || e6(t)
            }

            function e7(e) {
                return Array.from(e1(e).trim()).length > 24
            }

            function e9(e) {
                let t = e1(e);
                return t && ("all" === t || e_.ZP[t]) ? t : null
            }

            function te(e) {
                return "all" === e ? "All Sports" : e.toUpperCase()
            }
            let tt = {
                    atp: "ATP (Men's)",
                    wta: "WTA (Women's)",
                    atp_challenger: "ATP Challenger (Men's)",
                    six_kings_slam: "Six Kings Slam"
                },
                ts = {
                    atp: 0,
                    wta: 1,
                    atp_challenger: 2
                };

            function tr(e) {
                var t;
                return e ? null !== (t = tt[e]) && void 0 !== t ? t : e.split("_").filter(Boolean).map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(" ") : "Tennis"
            }

            function tn(e, t) {
                return e.length === t.length && e.every((e, s) => e === t[s])
            }

            function ta(e, t) {
                let s = [...e].sort();
                if (!(null == t ? void 0 : t.length)) return s;
                let r = new Set(e);
                return t.every(e => r.has(e)) ? [] : s
            }

            function tl(e, t, s) {
                let r = e.apps.length !== t.length || e.apps.some(e => !t.includes(e)),
                    n = !tn(e.sort, s),
                    a = !!e4(e.winChanceRange),
                    l = !!(e.oddsFilter.minOdds || e.oddsFilter.maxOdds || "app" === e.oddsFilter.oddsSource || "either" !== e.oddsFilter.oddsSide),
                    i = !!((e.hitRateFilter.min || e.hitRateFilter.max) && e.hitRateFilter.columns.length > 0),
                    o = !!(e.tennisRankFilter.playerRankMin || e.tennisRankFilter.playerRankMax || e.tennisRankFilter.rankDiffMin || e.tennisRankFilter.rankDiffMax);
                return !!(r || "any" !== e.modifier || e.showAltLines || e.stats.length > 0 || n || a || l || i || o)
            }

            function ti(e) {
                return "string" != typeof e || "" === e.trim() ? null : Number.isFinite(new Date(e).getTime()) ? e : null
            }

            function to(e) {
                if (!e0(e)) return null;
                let t = function(e) {
                        if (2 !== e.v || !e0(e.p)) return e;
                        let t = e.p,
                            s = Array.isArray(t.o) ? t.o : [],
                            r = Array.isArray(t.h) ? t.h : [],
                            n = Array.isArray(t.t) ? t.t : [];
                        return {
                            version: 1,
                            name: e.n,
                            payload: {
                                version: 1,
                                sport: t.sp,
                                apps: t.a,
                                modifier: t.m,
                                showAltLines: t.al,
                                stats: t.st,
                                sort: t.so,
                                winChanceRange: t.w,
                                oddsFilter: {
                                    minOdds: s[0],
                                    maxOdds: s[1],
                                    oddsSource: s[2],
                                    oddsApp: s[3],
                                    oddsSide: s[4]
                                },
                                hitRateFilter: {
                                    min: r[0],
                                    max: r[1],
                                    columns: r[2]
                                },
                                tennisRankFilter: {
                                    playerRankMin: n[0],
                                    playerRankMax: n[1],
                                    rankDiffMin: n[2],
                                    rankDiffMax: n[3]
                                }
                            }
                        }
                    }(e),
                    s = function(e) {
                        var t;
                        if (!e0(e)) return null;
                        let s = e0(e.sportFilters) ? e.sportFilters : {},
                            r = Array.isArray(e.stats) ? e.stats : s.stats,
                            n = e4(e.winChanceRange || s.winChanceRange);
                        return {
                            version: 1,
                            sport: e9(e.sport),
                            apps: e5(e.apps),
                            modifier: e1(e.modifier, "any"),
                            showAltLines: !0 === e.showAltLines,
                            stats: e5(r),
                            sort: e5(e.sort),
                            winChanceRange: n,
                            oddsFilter: function(e) {
                                if (!e0(e)) return { ...eL.qi
                                };
                                let t = "app" === e.oddsSource ? "app" : "best",
                                    s = "over" === e.oddsSide || "under" === e.oddsSide || "either" === e.oddsSide ? e.oddsSide : "either";
                                return {
                                    minOdds: e1(e.minOdds),
                                    maxOdds: e1(e.maxOdds),
                                    oddsSource: t,
                                    oddsApp: e1(e.oddsApp),
                                    oddsSide: s
                                }
                            }(e.oddsFilter),
                            hitRateFilter: function(e) {
                                var t, s, r;
                                if (!e0(e)) return { ...eL.RT
                                };
                                let n = e5(e.columns);
                                return { ...(t = e1(e.min), s = e1(e.max), r = n.length, t.trim() === eK && s.trim() === eK ? r > 0 ? {
                                        min: eK,
                                        max: eX
                                    } : {
                                        min: "",
                                        max: ""
                                    } : {
                                        min: t,
                                        max: s
                                    }),
                                    columns: n
                                }
                            }(e.hitRateFilter),
                            tennisRankFilter: e0(t = e.tennisRankFilter) ? {
                                playerRankMin: e1(t.playerRankMin),
                                playerRankMax: e1(t.playerRankMax),
                                rankDiffMin: e1(t.rankDiffMin),
                                rankDiffMax: e1(t.rankDiffMax)
                            } : { ...eL.lW
                            }
                        }
                    }(e0(t.payload) ? t.payload : t);
                if (!s) return null;
                let r = e1(t.sport, "props");
                return {
                    version: 1,
                    name: e8(t.name, r),
                    payload: s
                }
            }

            function td(e) {
                return (Array.isArray(e) ? e : []).map(e => (function(e) {
                    var t, s;
                    if (!e0(e)) return null;
                    let r = to(e);
                    if (!r) return null;
                    let n = new Date().toISOString();
                    return { ...r,
                        id: e1(e.id) || tp(),
                        createdAt: null !== (t = ti(e.createdAt)) && void 0 !== t ? t : n,
                        updatedAt: null !== (s = ti(e.updatedAt)) && void 0 !== s ? s : n
                    }
                })(e)).filter(e => !!e).slice(0, 20)
            }

            function tc(e) {
                return e0(e) ? td(e[e$]) : []
            }

            function tu(e) {
                let {
                    payload: t
                } = e, s = {}, r = e4(t.winChanceRange);
                return t.sport && (s.sp = t.sport), t.apps.length > 0 && (s.a = t.apps), "any" !== t.modifier && (s.m = t.modifier), t.showAltLines && (s.al = !0), t.stats.length > 0 && (s.st = t.stats), t.sort.length > 0 && (s.so = t.sort), r && (s.w = r), (t.oddsFilter.minOdds || t.oddsFilter.maxOdds || "best" !== t.oddsFilter.oddsSource || t.oddsFilter.oddsApp || "either" !== t.oddsFilter.oddsSide) && (s.o = [t.oddsFilter.minOdds, t.oddsFilter.maxOdds, t.oddsFilter.oddsSource, t.oddsFilter.oddsApp, t.oddsFilter.oddsSide]), (t.hitRateFilter.min || t.hitRateFilter.max || t.hitRateFilter.columns.length > 0) && (s.h = [t.hitRateFilter.min, t.hitRateFilter.max, t.hitRateFilter.columns]), (t.tennisRankFilter.playerRankMin || t.tennisRankFilter.playerRankMax || t.tennisRankFilter.rankDiffMin || t.tennisRankFilter.rankDiffMax) && (s.t = [t.tennisRankFilter.playerRankMin, t.tennisRankFilter.playerRankMax, t.tennisRankFilter.rankDiffMin, t.tennisRankFilter.rankDiffMax]), {
                    v: 2,
                    n: e.name,
                    p: s
                }
            }

            function tm(e) {
                return { ...tu(e),
                    id: e.id,
                    createdAt: e.createdAt,
                    updatedAt: e.updatedAt
                }
            }

            function tp() {
                return "undefined" != typeof crypto && "randomUUID" in crypto ? crypto.randomUUID() : "preset-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2))
            }

            function tx(e, t) {
                let {
                    payload: s
                } = e, r = [], n = e4(s.winChanceRange);
                return s.sport && r.push(te(s.sport)), s.apps.length > 0 && s.apps.length !== t ? r.push("".concat(s.apps.length, " app").concat(1 === s.apps.length ? "" : "s")) : r.push("All apps"), r.push("any" === s.modifier ? "Any modifier" : s.modifier), s.stats.length > 0 && r.push("".concat(s.stats.length, " stat").concat(1 === s.stats.length ? "" : "s")), s.sort.length > 0 && r.push("".concat(s.sort.length, " sort").concat(1 === s.sort.length ? "" : "s")), n && r.push("moneyline"), s.showAltLines && r.push("alt lines"), (s.oddsFilter.minOdds || s.oddsFilter.maxOdds || "app" === s.oddsFilter.oddsSource) && r.push("odds"), (s.hitRateFilter.min || s.hitRateFilter.max || s.hitRateFilter.columns.length > 0) && r.push("hit rate"), (s.tennisRankFilter.playerRankMin || s.tennisRankFilter.playerRankMax || s.tennisRankFilter.rankDiffMin || s.tennisRankFilter.rankDiffMax) && r.push("ranks"), r.slice(0, 5).join(" / ")
            }
            let th = [{
                id: "hitRateLast5",
                label: "L5"
            }, {
                id: "hitRateLast10",
                label: "L10"
            }, {
                id: "hitRateLast15",
                label: "L15"
            }, {
                id: "hitRateH2H",
                label: "H2H"
            }];

            function tf(e) {
                let t = Number(e);
                if (!Number.isFinite(t)) return;
                let s = Math.round(10 * t) / 10,
                    r = Number.isInteger(s) ? String(s) : s.toFixed(1),
                    n = s > 0 ? "+" : "";
                return "".concat(n).concat(r, "%")
            }

            function tg(e) {
                let {
                    h2hHits: t,
                    h2hGames: s
                } = e, r = Number(t), n = Number(s);
                if (Number.isFinite(r) && Number.isFinite(n) && !(n <= 0)) return "".concat(r, "/").concat(n)
            }

            function tb(e) {
                if (null == e || "" === e) return "";
                let t = "number" == typeof e ? e : Number(e);
                return Number.isFinite(t) ? t > 0 ? "+".concat(t) : "".concat(t) : String(e)
            }

            function tv(e) {
                if (null == e || "" === String(e).trim()) return "";
                let t = Number(e);
                return !Number.isFinite(t) || t <= 0 ? "" : " (#".concat(t, ")")
            }

            function tj(e, t) {
                return (0, n.Z)("transition-[background,border-color] duration-200 px-2", e ? "border-[#2f2fdd] bg-[#2f2fdd] text-white hover:bg-[#4040FF]/90" : "border-input bg-input-bg hover:bg-input-border", t)
            }

            function tw(e) {
                return (0, n.Z)("h-4 w-4 shrink-0", e ? "text-white" : "text-muted-foreground")
            }

            function tN(e) {
                return (0, n.Z)("min-w-0 truncate text-sm font-medium", e ? "text-white" : "text-muted-foreground")
            }

            function ty(e) {
                return (0, n.Z)("h-4 shrink-0 cursor-pointer", e ? "text-white/90" : "text-muted-foreground")
            }

            function tk(e) {
                let {
                    onClear: t
                } = e;
                return (0, r.jsx)(j.mpJ, {
                    className: "h-5 w-5 shrink-0 cursor-pointer text-white hover:text-white/80",
                    onClick: e => {
                        e.stopPropagation(), t()
                    }
                })
            }

            function tC(e) {
                let {
                    onClick: t,
                    className: s,
                    iconOnly: a = !1
                } = e;
                return (0, r.jsx)(D.z, {
                    type: "button",
                    variant: "secondary",
                    onClick: t,
                    className: (0, n.Z)("h-11 rounded-xl border border-[#2f2fdd] bg-[#2f2fdd] text-sm font-medium text-white hover:bg-[#4040FF]/90 hover:text-white", a ? "w-11 px-0" : "px-3", s),
                    "aria-label": "Clear all filters",
                    children: (0, r.jsx)(ex.Z, {
                        className: "h-4 w-4 shrink-0"
                    })
                })
            }
            let tM = (e, t) => {
                    let s = e.replace(/^-/, ""),
                        r = t.findIndex(e => e.replace(/^-/, "") === s);
                    return r >= 0 ? r + 1 : null
                },
                tF = (e, t) => {
                    let s = e.replace(/^-/, ""),
                        r = t.find(e => e.replace(/^-/, "") === s);
                    return r ? r.startsWith("-") ? "desc" : "asc" : null
                };

            function t_(e) {
                let {
                    compact: t = !1,
                    className: s
                } = e;
                return (0, r.jsxs)("span", {
                    role: "status",
                    className: (0, en.cn)("inline-flex shrink-0 items-center gap-1 ml-4", t ? "gap-0.5 px-1.5 py-px text-[10px]" : "text-[11px]", s),
                    children: [(0, r.jsxs)("span", {
                        className: (0, en.cn)("relative flex shrink-0", t ? "h-1.5 w-1.5" : "h-2 w-2"),
                        "aria-hidden": !0,
                        children: [(0, r.jsx)("span", {
                            className: (0, en.cn)("absolute inline-flex rounded-full bg-red-400 opacity-70 motion-safe:animate-ping", t ? "h-1.5 w-1.5" : "h-2 w-2")
                        }), (0, r.jsx)("span", {
                            className: (0, en.cn)("relative inline-flex rounded-full bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.85)]", t ? "h-1.5 w-1.5" : "h-2 w-2")
                        })]
                    }), (0, r.jsx)("span", {
                        className: "font-semibold uppercase tracking-wide text-red-100 ml-1",
                        children: "Live"
                    })]
                })
            }

            function tS(e) {
                let t = e => e.length <= 10 ? e : "".concat(e.slice(0, 9), "..."),
                    s = e.trim().split(/\s+/);
                if (s.length < 2) return t(e);
                if (s.length > 2) return t("".concat(s[0][0], ". ").concat(s[s.length - 1]));
                let r = "".concat(s[0][0], ". ").concat(s.slice(1).join(" "));
                return r.length <= 10 ? r : t("".concat(s[0][0], ". ").concat(s[s.length - 1]))
            }

            function tR(e) {
                var t, s;
                let {
                    sport: a,
                    awayTeam: l,
                    homeTeam: i,
                    startTime: d,
                    isLive: c,
                    showTime: u = !0,
                    compact: m = !0
                } = e, p = "tennis" === a, x = null !== (s = null === (t = e_.ZP[a]) || void 0 === t ? void 0 : t.esport) && void 0 !== s && s, h = m ? 18 : 22, f = null != l.ml_percent ? Math.min(99, Math.max(1, Math.round(100 * l.ml_percent))) : null, g = null != i.ml_percent ? Math.min(99, Math.max(1, Math.round(100 * i.ml_percent))) : null, b = p ? "!rounded-full" : void 0, v = function(e) {
                    if (!e) return null;
                    let t = o()(e);
                    if (!t.isValid()) return null;
                    let s = t.format("h:mma");
                    return [t.isSame(o()(), "day") ? "" : t.format("ddd"), s].filter(Boolean).join(" ")
                }(d), j = p || x ? "VS" : "@", w = m ? "max-w-[3.75rem] text-[11px]" : p ? "max-w-[6.5rem] text-xs" : x ? "max-w-[6rem] text-xs" : "max-w-[4rem] text-xs", N = e => p ? tS(e.name) : e.abbreviation || e.name, y = (e, t) => (0, r.jsxs)("span", {
                    className: (0, n.Z)("rounded-full border px-1.5 py-px text-[9px] leading-none shrink-0", null != t && e > t ? "bg-gradient-to-t from-green-600/50 to-green-600/15 text-green-300 border-green-600" : null != t && e < t ? "bg-gradient-to-t from-red-600/50 to-red-600/15 text-red-300 border-red-600" : "bg-gradient-to-t from-gray-600/50 to-gray-600/15 text-gray-300 border-gray-600"),
                    children: [e, "%"]
                }), k = (e, t, s, l) => {
                    let i = (0, r.jsx)(em.Z, {
                            abbreviation: e.abbreviation,
                            sport: a,
                            imageUrl: e.image,
                            size: h,
                            imageClassName: b
                        }),
                        o = Number(e.rank),
                        d = p && Number.isFinite(o) && o > 0 ? "#".concat(o) : "";
                    return (0, r.jsxs)("div", {
                        className: (0, n.Z)("flex min-w-0 items-center gap-1.5", "right" === l && "justify-end"),
                        children: ["left" === l && i, (0, r.jsxs)("div", {
                            className: (0, n.Z)("flex min-w-0 flex-col gap-1", "right" === l && "items-end text-right"),
                            children: [(0, r.jsx)("span", {
                                className: (0, n.Z)("truncate font-medium leading-none text-foreground", w),
                                children: N(e)
                            }), null != t && (0, r.jsxs)("span", {
                                className: (0, n.Z)("flex items-center gap-1 text-[9px] leading-none text-muted-foreground", w),
                                children: [d && (0, r.jsx)("span", {
                                    className: "shrink-0 text-muted-foreground",
                                    children: d
                                }), y(t, s)]
                            })]
                        }), "right" === l && i]
                    })
                }, C = u && c ? (0, r.jsx)(t_, {
                    compact: !0,
                    className: "ml-0"
                }) : u && v ? (0, r.jsx)("span", {
                    className: "rounded-md bg-muted/80 px-2 py-1 text-[10px] leading-none text-muted-foreground",
                    children: (0, r.jsx)("span", {
                        className: "whitespace-nowrap",
                        children: v
                    })
                }) : null;
                return (0, r.jsxs)("div", {
                    className: "flex w-full max-w-full min-w-0 items-center justify-between gap-2",
                    children: [(0, r.jsxs)("div", {
                        className: (0, n.Z)("flex min-w-0 items-center", "gap-3"),
                        children: [k(l, f, g, "left"), j && (0, r.jsx)("span", {
                            className: (0, n.Z)("shrink-0 uppercase leading-none text-muted-foreground", "VS" === j ? "text-xs font-semibold" : "text-sm font-bold"),
                            children: j
                        }), k(i, g, f, "right")]
                    }), C && (0, r.jsx)("span", {
                        className: "ml-auto shrink-0",
                        children: C
                    })]
                })
            }
            let tZ = "inline-flex h-5 shrink-0 items-stretch overflow-hidden rounded-md border border-white/10 text-[10px] font-semibold leading-none",
                tA = "flex items-center gap-1 bg-white/5 px-1.5 text-slate-400",
                tP = "flex items-center px-1.5 tabular-nums";

            function tL(e, t) {
                return "tennis" === t ? "vs ".concat(tS(e.opponent.name)).concat(tv(e.opponent.rank)) : e.game_string
            }

            function tD(e, t, s) {
                return !!e.team_ml_percent || (s || eU.includes(t)) && e.defenseRank > 0 || "tennis" === t && null != tO(e)
            }

            function tO(e) {
                let t = Number(e.team.rank),
                    s = Number(e.opponent.rank);
                return !Number.isFinite(t) || t <= 0 || !Number.isFinite(s) || s <= 0 ? null : s - t
            }

            function tz(e) {
                let {
                    prop: t
                } = e, s = tO(t);
                return null == s ? null : (0, r.jsxs)("span", {
                    className: tZ,
                    title: "".concat(t.player_name, " is ranked #").concat(Number(t.team.rank), " vs #").concat(Number(t.opponent.rank), " — positive means the better rank"),
                    children: [(0, r.jsxs)("span", {
                        className: tA,
                        children: [(0, r.jsx)(v.PIe, {
                            className: "h-2.5 w-2.5 shrink-0"
                        }), "Rank Diff"]
                    }), (0, r.jsx)("span", {
                        className: (0, n.Z)(tP, s >= 100 ? eo(90) : s >= 50 ? eo(77) : s >= 15 ? eo(60) : s > -15 ? eo(42) : s > -50 ? eo(25) : eo(10)),
                        children: s > 0 ? "+".concat(s) : s
                    })]
                })
            }

            function tI(e) {
                let {
                    children: t
                } = e, s = (0, a.useRef)(null), [l, i] = (0, a.useState)(!1);
                return (0, a.useEffect)(() => {
                    var e;
                    let t = null === (e = s.current) || void 0 === e ? void 0 : e.querySelector("[data-radix-scroll-area-viewport]");
                    if (!t) return;
                    let r = () => {
                        i(t.scrollLeft + t.clientWidth < t.scrollWidth - 1)
                    };
                    r(), t.addEventListener("scroll", r, {
                        passive: !0
                    });
                    let n = new ResizeObserver(r);
                    return n.observe(t), t.firstElementChild && n.observe(t.firstElementChild), () => {
                        t.removeEventListener("scroll", r), n.disconnect()
                    }
                }, []), (0, r.jsxs)("div", {
                    className: "relative mt-2.5 w-full min-w-0",
                    children: [(0, r.jsxs)(eO.x, {
                        ref: s,
                        className: "w-full min-w-0 pointer-events-auto",
                        children: [(0, r.jsx)("div", {
                            className: "flex items-center gap-1",
                            children: t
                        }), (0, r.jsx)(eO.B, {
                            orientation: "horizontal",
                            className: "h-1.5"
                        })]
                    }), (0, r.jsx)("div", {
                        className: (0, n.Z)("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-new-bg to-transparent transition-opacity duration-200", l ? "opacity-100" : "opacity-0")
                    })]
                })
            }

            function tT(e) {
                let {
                    prop: t,
                    sport: s
                } = e, a = t.team_ml_percent && t.team_ml_percent > 0 ? 100 * t.team_ml_percent : null;
                if (null == a) return null;
                let l = Math.min(99, Math.max(1, Math.round(a))),
                    i = "Moneyline",
                    o = "tennis" !== s && e_.U8.has(s),
                    d = "tennis" === s ? "".concat(t.player_name, " match win chance from sportsbook moneyline odds") : "".concat(i, " win chance from sportsbook moneyline odds");
                return (0, r.jsxs)("span", {
                    className: tZ,
                    title: d,
                    children: [(0, r.jsxs)("span", {
                        className: tA,
                        children: [o && (0, r.jsx)(em.Z, {
                            abbreviation: t.team.abbreviation,
                            sport: s,
                            imageUrl: t.team.image,
                            size: 12
                        }), (0, r.jsx)("span", {
                            className: "max-w-[4.5rem] truncate",
                            children: i
                        })]
                    }), (0, r.jsxs)("span", {
                        className: (0, n.Z)(tP, eo(l)),
                        children: [l, "%"]
                    })]
                })
            }

            function tE(e) {
                let {
                    prop: t,
                    sport: s
                } = e;
                if (!(t.defenseRank > 0)) return null;
                let n = t.sport || s,
                    a = "mlb" === n,
                    l = t.opponent.abbreviation || t.opponent.name,
                    i = sj(t.defenseRank, n, t),
                    o = function(e) {
                        if (!e) return !1;
                        let t = e.trim().toLowerCase();
                        return !t.includes("unknown.jpg") && !t.includes("fallback.png")
                    }(t.opponent.image),
                    d = a ? "".concat(l, " has the ").concat(sv(t.defenseRank), " highest strikeout rate this season — 1st strikes out the most (softest K matchup)") : "".concat(l, " defense ranks ").concat(sv(t.defenseRank), " vs ").concat(t.stat, " — 1st is the toughest matchup");
                return (0, r.jsxs)("span", {
                    className: tZ,
                    title: d,
                    children: [(0, r.jsxs)("span", {
                        className: tA,
                        children: [o ? (0, r.jsx)(em.Z, {
                            abbreviation: t.opponent.abbreviation,
                            sport: n,
                            imageUrl: t.opponent.image,
                            size: 12
                        }) : (0, r.jsx)(U.Z, {
                            className: "h-2.5 w-2.5 shrink-0"
                        }), a ? "K% Rank" : "Defense"]
                    }), (0, r.jsxs)("span", {
                        className: tP,
                        style: {
                            color: c.Z.mix(i, "white", .35).hex(),
                            backgroundColor: (0, c.Z)(i).alpha(.15).css()
                        },
                        children: ["#", t.defenseRank]
                    })]
                })
            }

            function tU(e) {
                var t;
                let {
                    awayAbbr: s,
                    homeAbbr: n,
                    awayImage: a,
                    homeImage: l,
                    sport: i,
                    size: o = 24
                } = e, d = (null === (t = e_.ZP[i]) || void 0 === t ? void 0 : t.esport) || "tennis" === i ? "VS" : "@", c = "tennis" === i ? "!rounded-full" : void 0;
                return (0, r.jsx)("div", {
                    className: "inline-flex h-9 shrink-0 items-center px-1",
                    children: (0, r.jsxs)("div", {
                        className: "flex shrink-0 items-center -space-x-2.5",
                        children: [(0, r.jsx)("span", {
                            className: "relative z-10 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-new-bg shadow-sm",
                            children: (0, r.jsx)(em.Z, {
                                abbreviation: s,
                                sport: i,
                                imageUrl: a,
                                size: o + 2,
                                imageClassName: c
                            })
                        }), (0, r.jsx)("span", {
                            className: "relative z-0 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-input-bg text-[9px] font-bold text-muted-foreground shadow-sm",
                            children: d
                        }), (0, r.jsx)("span", {
                            className: "relative z-10 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-new-bg shadow-sm",
                            children: (0, r.jsx)(em.Z, {
                                abbreviation: n,
                                sport: i,
                                imageUrl: l,
                                size: o + 2,
                                imageClassName: c
                            })
                        })]
                    })
                })
            }

            function tV(e) {
                let {
                    selectedGameIds: t,
                    games: s,
                    sport: n,
                    maxDisplay: a = 3
                } = e, l = t.map(e => s.find(t => t.id === e)).filter(e => !!e && !!e.homeTeam && !!e.awayTeam);
                if (0 === l.length) return (0, r.jsxs)("span", {
                    className: "text-xs text-primary",
                    children: [t.length, " Games"]
                });
                "tennis" === n && (a = 1);
                let i = a > 0 ? l.slice(0, a) : l,
                    o = l.length - i.length,
                    d = t.length - l.length;
                return (0, r.jsxs)("div", {
                    className: "flex min-w-0 flex-nowrap items-center overflow-hidden",
                    children: [i.map(e => {
                        var t;
                        let s = null !== (t = e.sport) && void 0 !== t ? t : n;
                        return (0, r.jsxs)("div", {
                            className: "inline-flex shrink-0 items-center first:ml-0",
                            children: [(0, r.jsx)("span", {
                                className: "mr-2 h-6 w-px bg-white/10 first:hidden"
                            }), (0, r.jsx)(tU, {
                                awayAbbr: e.awayTeam.abbreviation,
                                homeAbbr: e.homeTeam.abbreviation,
                                awayImage: e.awayTeam.image,
                                homeImage: e.homeTeam.image,
                                sport: s,
                                size: 18
                            })]
                        }, e.id)
                    }), (o > 0 || d > 0) && (0, r.jsxs)("span", {
                        className: "shrink-0 text-xs font-medium text-muted-foreground",
                        children: ["+", o + d]
                    })]
                })
            }

            function tB(e) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 20;
                return e.length <= t ? e : "".concat(e.slice(0, Math.max(0, t - 3)).trimEnd(), "...")
            }

            function tH(e) {
                let {
                    selectedTeamKeys: t,
                    teams: s,
                    sport: n,
                    maxDisplay: a = 2
                } = e, l = t.map(e => s.find(t => t.key === e)).filter(e => !!e);
                if (0 === l.length) return (0, r.jsxs)("span", {
                    className: "text-xs text-primary",
                    children: [t.length, " ", 1 === t.length ? "Team" : "Teams"]
                });
                let i = a > 0 ? l.slice(0, a) : l,
                    o = l.length - i.length,
                    d = t.length - l.length;
                return (0, r.jsxs)("div", {
                    className: "flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden",
                    children: [i.map(e => (0, r.jsxs)("span", {
                        className: "inline-flex shrink-0 items-center gap-1.5",
                        children: [(0, r.jsx)("span", {
                            className: "grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-new-bg",
                            children: (0, r.jsx)(em.Z, {
                                abbreviation: e.abbreviation,
                                sport: n,
                                imageUrl: e.image,
                                size: 16
                            })
                        }), (0, r.jsx)("span", {
                            className: "max-w-[96px] truncate text-xs font-medium text-white",
                            title: e.abbreviation,
                            children: tB(e.abbreviation)
                        })]
                    }, e.key)), (o > 0 || d > 0) && (0, r.jsxs)("span", {
                        className: "shrink-0 text-xs font-medium text-muted-foreground",
                        children: ["+", o + d]
                    })]
                })
            }
            let tW = (0, a.memo)(function(e) {
                    let {
                        tableColumns: t,
                        sortSettings: s,
                        setSortSetting: a
                    } = e, l = ["chances", "hitRateLast5", "hitRateLast10", "hitRateLast15", "hitRateH2H", "streak", "differenceLast10", "defenseRank"], i = [...t].sort((e, t) => {
                        let s = e.sortId ? l.indexOf(e.sortId) : -1,
                            r = t.sortId ? l.indexOf(t.sortId) : -1;
                        return -1 !== s && -1 !== r ? s - r : -1 !== s ? -1 : -1 !== r ? 1 : 0
                    });
                    return (0, r.jsx)("div", {
                        className: "md:hidden flex",
                        children: (0, r.jsx)("div", {
                            className: "flex h-max gap-1 items-center overflow-x-auto custom-scrollbar [overflow-anchor:none] overscroll-x-contain",
                            children: i.map(e => {
                                if (!e.sortId) return null;
                                let t = null !== tM("differencePercent", s) ? "differencePercent" : "differenceLast10",
                                    l = "differenceLast10" === e.sortId ? tM(t, s) : tM(e.sortId, s),
                                    i = "chances" === e.sortId ? null !== tM("-consensus_over_ip", s) || null !== tM("-consensus_under_ip", s) : "differenceLast10" === e.sortId ? null !== tM("differenceLast10", s) || null !== tM("differencePercent", s) : null !== l,
                                    o = "differenceLast10" === e.sortId ? tF(t, s) : tF(e.sortId, s),
                                    d = i && "asc" === o ? (0, r.jsx)(eC.Z, {
                                        size: 16
                                    }) : (0, r.jsx)(eM.Z, {
                                        size: 16
                                    }),
                                    c = (0, n.Z)("text-muted-foreground rounded-lg flex flex-shrink-0 min-w-0 items-center gap-1 bg-background border", i ? "border-button bg-highlight" : "border-input", "hover:bg-highlight");
                                if ("chances" === e.sortId) return (0, r.jsxs)(k.h_, {
                                    children: [(0, r.jsx)(k.$F, {
                                        asChild: !0,
                                        children: (0, r.jsxs)(D.z, {
                                            size: "sm",
                                            variant: "secondary",
                                            className: c,
                                            children: ["Player" === e.name ? "Most Recent" : e.name, (null !== tM("-consensus_over_ip", s) || null !== tM("-consensus_under_ip", s)) && (0, r.jsx)(r.Fragment, {
                                                children: (0, r.jsx)(tG, {
                                                    position: null !== tM("-consensus_over_ip", s) ? tM("-consensus_over_ip", s) : tM("-consensus_under_ip", s)
                                                })
                                            }), d]
                                        }, e.sortId)
                                    }), (0, r.jsxs)(k.AW, {
                                        className: "bg-new-bg",
                                        children: [(0, r.jsx)(k.Xi, {
                                            disabled: !0,
                                            className: "text-sm font-semibold max-w-60 text-slate-200",
                                            children: "Sort By (Choose One)"
                                        }), (0, r.jsxs)(k.Xi, {
                                            onClick: () => {
                                                a("-consensus_over_ip")
                                            },
                                            className: (0, n.Z)("flex items-center gap-2", null !== tM("-consensus_over_ip", s) && "bg-highlight"),
                                            children: [(0, r.jsx)("div", {
                                                className: (0, n.Z)("w-4 h-4 rounded-full border flex items-center justify-center", null !== tM("-consensus_over_ip", s) ? "border-blue-500" : "border-gray-500"),
                                                children: null !== tM("-consensus_over_ip", s) && (0, r.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-blue-500"
                                                })
                                            }), (0, r.jsx)("span", {
                                                children: "% Chance Of Over Hitting"
                                            }), null !== tM("-consensus_over_ip", s) && (0, r.jsx)(tG, {
                                                position: tM("-consensus_over_ip", s)
                                            })]
                                        }), (0, r.jsxs)(k.Xi, {
                                            onClick: () => {
                                                a("-consensus_under_ip")
                                            },
                                            className: (0, n.Z)("flex items-center gap-2", null !== tM("-consensus_under_ip", s) && "bg-highlight"),
                                            children: [(0, r.jsx)("div", {
                                                className: (0, n.Z)("w-4 h-4 rounded-full border flex items-center justify-center", null !== tM("-consensus_under_ip", s) ? "border-blue-500" : "border-gray-500"),
                                                children: null !== tM("-consensus_under_ip", s) && (0, r.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-blue-500"
                                                })
                                            }), (0, r.jsx)("span", {
                                                children: "% Chance Of Under Hitting"
                                            }), null !== tM("-consensus_under_ip", s) && (0, r.jsx)(tG, {
                                                position: tM("-consensus_under_ip", s)
                                            })]
                                        }), (0, r.jsx)(k.Xi, {
                                            disabled: !0,
                                            className: "text-xs max-w-64 text-slate-300",
                                            children: e.description
                                        })]
                                    })]
                                }, "chances");
                                if ("differenceLast10" === e.sortId) {
                                    var u;
                                    let e = null !== tM("differencePercent", s) ? "differencePercent" : "differenceLast10",
                                        t = tM(e, s),
                                        n = null !== (u = tF(e, s)) && void 0 !== u ? u : "desc";
                                    return (0, r.jsxs)(k.h_, {
                                        children: [(0, r.jsx)(k.$F, {
                                            asChild: !0,
                                            children: (0, r.jsxs)(D.z, {
                                                size: "sm",
                                                variant: "secondary",
                                                className: c,
                                                children: ["differencePercent" === e && null !== t ? "Diff %" : "Diff", null !== t && (0, r.jsx)(tG, {
                                                    position: t
                                                }), d]
                                            })
                                        }), (0, r.jsx)(tq, {
                                            activeMetric: e,
                                            activeDirection: n,
                                            hasActiveSort: null !== t,
                                            setSortSetting: a
                                        })]
                                    }, "diff-sort")
                                }
                                return (0, r.jsxs)(D.z, {
                                    size: "sm",
                                    variant: "secondary",
                                    className: c,
                                    onClick: t => {
                                        if (t.preventDefault(), !e.sortId) return;
                                        let r = tM(e.sortId, s);
                                        tF(e.sortId, s), null !== r ? a(e.sortId) : a("-".concat(e.sortId))
                                    },
                                    children: ["Player" === e.name ? "Most Recent" : e.name, i && (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)(tG, {
                                            position: l
                                        }), (0, r.jsx)("div", {
                                            className: "cursor-pointer hover:text-white",
                                            onClick: t => {
                                                t.stopPropagation(), e.sortId && ("desc" === o ? a("-".concat(e.sortId)) : a(e.sortId))
                                            },
                                            children: (0, r.jsx)(eh.Z, {
                                                size: 12
                                            })
                                        })]
                                    }), d]
                                }, e.sortId)
                            })
                        })
                    })
                }),
                tG = e => {
                    let {
                        position: t
                    } = e;
                    return (0, r.jsx)("span", {
                        className: "ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-blue-500 text-white",
                        children: t
                    })
                },
                tJ = (e, t) => "".concat("desc" === t ? "-" : "").concat(e),
                tq = (0, a.memo)(function(e) {
                    let {
                        activeMetric: t,
                        activeDirection: s,
                        hasActiveSort: a,
                        setSortSetting: l
                    } = e, i = [{
                        id: "desc",
                        label: "High to low",
                        icon: (0, r.jsx)(eM.Z, {
                            width: 13
                        })
                    }, {
                        id: "asc",
                        label: "Low to high",
                        icon: (0, r.jsx)(eC.Z, {
                            width: 13
                        })
                    }];
                    return (0, r.jsx)(k.AW, {
                        className: "w-56 min-w-0 bg-new-bg p-2",
                        children: (0, r.jsxs)("div", {
                            className: "flex flex-col gap-2",
                            children: [(0, r.jsx)("div", {
                                children: (0, r.jsx)("div", {
                                    className: "grid grid-cols-2 gap-1 rounded-lg border border-input bg-input-bg/70 p-1",
                                    children: [{
                                        id: "differenceLast10",
                                        label: "Diff"
                                    }, {
                                        id: "differencePercent",
                                        label: "Diff %"
                                    }].map(e => {
                                        let i = a && t === e.id;
                                        return (0, r.jsx)("button", {
                                            type: "button",
                                            onClick: () => l(tJ(e.id, s)),
                                            className: (0, n.Z)("h-8 rounded-md text-xs font-semibold transition-colors", i ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-highlight hover:text-foreground"),
                                            children: e.label
                                        }, e.id)
                                    })
                                })
                            }), (0, r.jsxs)("div", {
                                children: [(0, r.jsx)("div", {
                                    className: "px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                                    children: "Order"
                                }), (0, r.jsx)("div", {
                                    className: "grid grid-cols-2 gap-1",
                                    children: i.map(e => {
                                        let i = a && s === e.id;
                                        return (0, r.jsxs)("button", {
                                            type: "button",
                                            onClick: () => l(tJ(t, e.id)),
                                            className: (0, n.Z)("flex h-8 items-center justify-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium transition-colors", i ? "border-blue-500 bg-blue-500 text-white" : "text-muted-foreground hover:bg-highlight hover:text-foreground"),
                                            children: [e.icon, (0, r.jsx)("span", {
                                                children: e.label
                                            })]
                                        }, e.id)
                                    })
                                })]
                            }), (0, r.jsx)("div", {
                                className: "rounded-lg bg-highlight/40 px-2 py-1.5 text-[11px] leading-snug text-slate-300",
                                children: "Diff is line vs L10 avg. Diff % converts that difference to a percent of the line."
                            })]
                        })
                    })
                }),
                tK = e => {
                    let {
                        position: t,
                        onClear: s
                    } = e;
                    return (0, r.jsxs)("span", {
                        "aria-label": "Sort priority ".concat(t).concat(s ? ", clear sort" : ""),
                        title: s ? "Clear sort" : "Sort priority ".concat(t),
                        onPointerDown: e => {
                            s && (e.preventDefault(), e.stopPropagation())
                        },
                        onClick: s,
                        className: (0, n.Z)("absolute -right-1.5 -top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full border border-new-bg bg-button text-[9px] font-bold leading-none text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] ring-1 ring-white/15 tabular-nums", s ? "cursor-pointer transition-colors group-hover/sort-trigger:bg-red-500" : "pointer-events-none"),
                        children: [(0, r.jsx)("span", {
                            className: (0, n.Z)("absolute inset-0 grid place-items-center transition-opacity duration-150", s && "group-hover/sort-trigger:opacity-0"),
                            children: t
                        }), s && (0, r.jsx)(eh.Z, {
                            strokeWidth: 3,
                            className: "absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover/sort-trigger:opacity-100"
                        })]
                    })
                };

            function tX(e) {
                var t, s, l, i, o, d, c, b, v, j, w, N, y;
                let {
                    alert: k
                } = e, {
                    userFilters: M,
                    initialFilters: F,
                    setUserFilter: _,
                    setSportFilter: z,
                    setOddsFilter: U,
                    setHitRateFilter: B,
                    setTennisRankFilter: H,
                    applyPropPresetFilters: W
                } = (0, eL.mN)(), {
                    user: G,
                    isLoaded: J,
                    isSignedIn: q
                } = (0, g.aF)(), {
                    isWebViewApp: K
                } = (0, E.B)(), X = null == G ? void 0 : null === (t = G.publicMetadata) || void 0 === t ? void 0 : t.plan, $ = (0, I.nt)(X), Q = "true" === eE.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app", [Y, ee] = (0, P.J)(), [et, es] = (0, R._)("apps", F.apps), [en, ea] = (0, R._)("singleModifier", "any", {
                    initializeWithValue: !1
                }), [el, ei] = (0, a.useState)([]), [eo, ed] = (0, a.useState)(!1), [ec, eu] = (0, a.useState)(!1), ep = (0, a.useRef)(!1), ex = (0, a.useRef)(!1), eg = (0, a.useRef)(!1), eb = (0, a.useRef)(null), ev = (0, a.useRef)(!1), ej = (0, a.useRef)(null), [ew, eN] = (0, a.useState)(!1), [ey, ek] = (0, a.useState)(null), [eC, eM] = (0, a.useState)(!1), {
                    sport: eF,
                    sportsParam: eS,
                    selectedSports: eR,
                    selectOnly: eZ
                } = (0, Z.w)();
                (0, a.useEffect)(() => {
                    if (!eg.current) {
                        eg.current = !0;
                        return
                    }
                    ep.current = !0
                }, [eF]);
                let [eA, eD] = (0, a.useState)(!1);
                (0, a.useEffect)(() => {
                    eD(!0)
                }, []);
                let ez = eA && J && !$,
                    eI = q ? "Upgrade to unlock" : "Sign in to unlock",
                    eT = q ? "Upgrade to save" : "Sign in to save",
                    eq = (0, a.useCallback)(function() {
                        let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                        return {
                            source: "props",
                            page: "/props",
                            sport: eF,
                            sports: eS,
                            ...(0, T.cz)({
                                isSignedIn: q,
                                plan: X,
                                isPwa: K,
                                isWebView: K
                            }),
                            ...e
                        }
                    }, [q, K, eF, eS, X]),
                    eK = (0, a.useCallback)(() => {
                        T.co.trackLockedFilterClicked(eq({
                            trigger: "locked_props_preview"
                        })), eM(!0)
                    }, [eq]),
                    eX = (0, a.useCallback)(() => {
                        T.co.trackLockedFilterClicked(eq({
                            trigger: "filters"
                        })), eM(!0)
                    }, [eq]),
                    e0 = (0, a.useCallback)(() => {
                        if (!J) return;
                        let e = eq({
                            featureName: "Pick Builder",
                            trigger: "favorite"
                        });
                        T.co.trackFavoritePaywallTriggered(e), T.co.trackPickBuilderPaywallTriggered(e), eM(!0)
                    }, [eq, J]),
                    e1 = M.sort,
                    e5 = (0, a.useMemo)(() => td(el), [el]);
                (0, a.useEffect)(() => {
                    J && ei(tc(null == G ? void 0 : G.unsafeMetadata))
                }, [J, null == G ? void 0 : G.unsafeMetadata]);
                let e2 = null !== (w = M.showAltLines) && void 0 !== w && w,
                    e3 = (0, a.useCallback)(e => _("showAltLines", e), [_]),
                    e6 = null !== (N = M.pushProps) && void 0 !== N ? N : "all",
                    te = (0, a.useCallback)(e => _("pushProps", e), [_]),
                    tt = M.oddsFilter.minOdds,
                    ti = M.oddsFilter.maxOdds,
                    tx = M.oddsFilter.oddsSource,
                    tf = M.oddsFilter.oddsApp,
                    tg = M.oddsFilter.oddsSide,
                    tb = !!(tt || ti),
                    tv = M.hitRateFilter.min,
                    tj = M.hitRateFilter.max,
                    tw = M.hitRateFilter.columns,
                    tN = (0, a.useMemo)(() => eU.includes(eF) || "cod" === eF || "soccer" === eF ? [...th, {
                        id: "hrSeason",
                        label: "SZN"
                    }] : th, [eF]),
                    ty = (0, a.useMemo)(() => {
                        let e = new Set(tN.map(e => e.id));
                        return tw.filter(t => e.has(t))
                    }, [tN, tw]),
                    tk = !!((tv || tj) && ty.length > 0),
                    tM = M.tennisRankFilter,
                    tF = !!("tennis" === eF && (tM.playerRankMin || tM.playerRankMax || tM.rankDiffMin || tM.rankDiffMax)),
                    t_ = e4(M.winChanceRange),
                    tS = (0, a.useCallback)(e => {
                        let t = e.replace(/^-/, ""),
                            s = [...e1];
                        if ("consensus_over_ip" === t || "consensus_under_ip" === t) {
                            let r = "consensus_over_ip" === t ? "consensus_under_ip" : "consensus_over_ip",
                                n = s.findIndex(e => e.replace(/^-/, "") === r);
                            if (n >= 0) {
                                s[n] = e, _("sort", s, eF);
                                return
                            }
                        }
                        if ("differenceLast10" === t || "differencePercent" === t) {
                            let r = "differenceLast10" === t ? "differencePercent" : "differenceLast10",
                                n = s.findIndex(e => e.replace(/^-/, "") === t),
                                a = s.findIndex(e => e.replace(/^-/, "") === r);
                            if (n >= 0) {
                                s[n] === e ? s.splice(n, 1) : s[n] = e, _("sort", s, eF), ep.current = !0;
                                return
                            }
                            if (a >= 0) {
                                s[a] = e, _("sort", s, eF), ep.current = !0;
                                return
                            }
                        }
                        let r = e1.findIndex(e => e.replace(/^-/, "") === t);
                        if (r >= 0) {
                            let t = e1[r];
                            t === e ? (s.splice(r, 1), s.length) : !t.startsWith("-") && e.startsWith("-") ? s.splice(r, 1) : s[r] = e
                        } else s.length >= 2 ? s[1] = e : s.push(e);
                        _("sort", s, eF), ep.current = !0
                    }, [eF, e1, _]),
                    tZ = (0, a.useCallback)(e => {
                        _("winChanceRange", e4(e), eF)
                    }, [_, eF]),
                    tA = (0, a.useCallback)(e => {
                        es(e), z(eF, "page", 1), ep.current = !0
                    }, [eF]),
                    tP = (0, a.useCallback)(e => {
                        z(eF, "games", e), z(eF, "page", 1), ep.current = !0
                    }, [eF]),
                    tL = (0, a.useCallback)(e => {
                        z(eF, "teams", e), z(eF, "page", 1), ep.current = !0
                    }, [eF]),
                    tD = (0, a.useCallback)(e => {
                        z(eF, "stats", e), z(eF, "page", 1), ep.current = !0
                    }, [eF]),
                    tO = (0, a.useCallback)(e => {
                        ea(e), z(eF, "page", 1), ep.current = !0
                    }, []),
                    tz = M.date,
                    tI = (0, a.useCallback)(e => {
                        _("date", e, eF), ep.current = !0
                    }, [eF]),
                    [tT, tE] = (0, a.useState)("");
                (0, a.useEffect)(() => {
                    tT && tI(new Date(tT))
                }, []), (0, a.useEffect)(() => {
                    tz && tE(tz.toISOString())
                }, [tz]);
                let [tU, tV] = (0, a.useState)((null === (s = M.sportFilters[eF]) || void 0 === s ? void 0 : s.search) || "");
                (0, a.useEffect)(() => {
                    var e;
                    tV((null === (e = M.sportFilters[eF]) || void 0 === e ? void 0 : e.search) || "")
                }, [eF]);
                let tH = (0, a.useCallback)(e => {
                        tV(e.target.value), ep.current = !0
                    }, []),
                    tG = (0, a.useRef)(!0);
                (0, a.useEffect)(() => {
                    if (tG.current) {
                        tG.current = !1;
                        return
                    }
                    let e = setTimeout(() => {
                        z(eF, "search", tU)
                    }, 400);
                    return () => {
                        clearTimeout(e)
                    }
                }, [tU]);
                let [tJ, tq] = (0, a.useState)(20), tK = (0, a.useRef)(null), {
                    data: tX,
                    isLoading: tQ
                } = (0, m.Z)(eA && $ ? "".concat(Q, "/props/filters?sport=").concat(eF).concat(eS ? "&sports=".concat(eS) : "") : null, {
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    refreshInterval: 6e4,
                    keepPreviousData: !0
                }), tY = eA && ez ? "".concat(Q, "/public/props?sport=").concat(encodeURIComponent(eF)).concat(eS ? "&sports=".concat(encodeURIComponent(eS)) : "") : null, {
                    data: t1,
                    error: t3
                } = (0, u.ZP)(tY, eJ, {
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    refreshInterval: 6e4,
                    keepPreviousData: !0
                }), sr = ez ? eG : tX, so = !ez && tQ, {
                    isMobile: sm
                } = (0, f.Ap)(), sp = (0, L.a)("(min-width: 1024px)"), {
                    data: sf,
                    mutate: sg,
                    isLoading: sb,
                    error: sv,
                    isValidating: sj
                } = (0, m.Z)(function(e) {
                    var t, s, r;
                    let n, a;
                    if (!$ || ez || sm || ey) return null;
                    let l = M.sportFilters[eF].page;
                    if (!sr || so) return null;
                    if (tz) {
                        let {
                            utcStart: e,
                            utcEnd: t
                        } = C(tz);
                        n = e, a = t
                    }
                    let i = ta(M.sportFilters[eF].stats, sr.stats),
                        o = et.length === F.apps.length ? "" : [...et].sort(),
                        d = (null === (t = M.sportFilters[eF]) || void 0 === t ? void 0 : t.games) || [],
                        c = d.length > 0 ? [...d].sort().join(",") : "",
                        u = (null === (s = M.sportFilters[eF]) || void 0 === s ? void 0 : s.teams) || [],
                        m = u.length > 0 ? [...u].sort().join(",") : "",
                        p = (0, S.s)({
                            sport: eF,
                            sports: eS,
                            search: null === (r = M.sportFilters[eF].search) || void 0 === r ? void 0 : r.trim(),
                            stat: i,
                            ...n && {
                                startDate: n,
                                endDate: a
                            },
                            app: o,
                            modifier: en,
                            games: c,
                            teams: "tennis" === eF ? "" : m,
                            sort: e1.length > 0 ? e1.join(",") : "",
                            page: l,
                            ...t_ && {
                                winChanceRange: t_
                            },
                            ...e2 && {
                                showAltLines: "true"
                            },
                            ..."all" !== e6 && {
                                pushProps: e6
                            },
                            ...tb && {
                                minOdds: tt,
                                maxOdds: ti,
                                oddsSource: tx,
                                oddsSide: tg,
                                ..."app" === tx && tf ? {
                                    oddsApp: tf
                                } : {}
                            },
                            ...tk && {
                                hitRateMin: tv,
                                hitRateMax: tj,
                                ...ty.length > 0 && {
                                    hitRateColumns: ty.join(",")
                                }
                            },
                            ...tF && {
                                playerRankMin: tM.playerRankMin,
                                playerRankMax: tM.playerRankMax,
                                rankDifferenceMin: tM.rankDiffMin,
                                rankDifferenceMax: tM.rankDiffMax
                            },
                            perPage: tJ
                        });
                    return "".concat(Q, "/props?").concat(p)
                }(0), {
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    refreshInterval: 3e4,
                    keepPreviousData: !0
                }), {
                    data: sw,
                    size: sN,
                    setSize: sy,
                    error: sk,
                    isLoading: sC,
                    isValidating: sM
                } = function(e, t) {
                    let {
                        getToken: s,
                        isLoaded: r,
                        userId: n
                    } = (0, x.y)(), l = !r, i = (0, a.useCallback)(async e => {
                        let t = await s();
                        if (!t) throw Error("Authentication token is not available.");
                        let r = await fetch(e, {
                            method: "GET",
                            mode: "cors",
                            headers: (0, h.i)(t)
                        });
                        if (!r.ok) throw Error("An error occurred while fetching the data.");
                        return r.json()
                    }, [s]), o = (0, a.useCallback)((t, s) => r && n ? e(t, s) : null, [e, r, n]), d = (0, p.ZP)(o, i, t);
                    return { ...d,
                        isLoading: l || d.isLoading,
                        isValidating: l || d.isValidating
                    }
                }(function(e, t) {
                    var s, r, n, a;
                    let l, i;
                    if (!$ || ez || e + 1 > 100 || !sm || ey || t && t.items && !t.items.length || !sr || so) return null;
                    if (tz) {
                        let {
                            utcStart: e,
                            utcEnd: t
                        } = C(tz);
                        l = e, i = t
                    }
                    let o = ta(M.sportFilters[eF].stats, sr.stats),
                        d = et.length === F.apps.length ? "" : [...et].sort(),
                        c = Array.isArray(null === (s = M.sportFilters[eF]) || void 0 === s ? void 0 : s.games) ? null === (r = M.sportFilters[eF]) || void 0 === r ? void 0 : r.games : [],
                        u = c.length > 0 ? [...c].sort().join(",") : "",
                        m = (null === (n = M.sportFilters[eF]) || void 0 === n ? void 0 : n.teams) || [],
                        p = m.length > 0 ? [...m].sort().join(",") : "",
                        x = (0, S.s)({
                            sport: eF,
                            sports: eS,
                            search: null === (a = M.sportFilters[eF].search) || void 0 === a ? void 0 : a.trim(),
                            stat: o,
                            ...l && {
                                startDate: l,
                                endDate: i
                            },
                            app: d,
                            modifier: en,
                            games: u,
                            teams: "tennis" === eF ? "" : p,
                            sort: e1.length > 0 ? e1.join(",") : "",
                            page: e + 1,
                            perPage: tJ,
                            ...t_ && {
                                winChanceRange: t_
                            },
                            ...e2 && {
                                showAltLines: "true"
                            },
                            ..."all" !== e6 && {
                                pushProps: e6
                            },
                            ...tb && {
                                minOdds: tt,
                                maxOdds: ti,
                                oddsSource: tx,
                                oddsSide: tg,
                                ..."app" === tx && tf ? {
                                    oddsApp: tf
                                } : {}
                            },
                            ...tk && {
                                hitRateMin: tv,
                                hitRateMax: tj,
                                ...ty.length > 0 && {
                                    hitRateColumns: ty.join(",")
                                }
                            },
                            ...tF && {
                                playerRankMin: tM.playerRankMin,
                                playerRankMax: tM.playerRankMax,
                                rankDifferenceMin: tM.rankDiffMin,
                                rankDifferenceMax: tM.rankDiffMax
                            }
                        });
                    return "".concat(Q, "/props?").concat(x)
                }, {
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    refreshInterval: 3e4,
                    revalidateFirstPage: !0,
                    keepPreviousData: !0
                }), sF = ez ? (null == t1 ? void 0 : t1.items.length) || 0 : (null == sw ? void 0 : null === (l = sw[0]) || void 0 === l ? void 0 : l.totalItems) || 0, s_ = (0, a.useMemo)(() => sw ? sw.reduce((e, t) => (null == t ? void 0 : t.items) ? [...e, ...t.items] : e, []) : [], [sw]), sS = (null == t1 ? void 0 : t1.items) || [], sR = ez ? sS : sm ? s_ : (null == sf ? void 0 : sf.items) || [], sZ = sR.length > 0, [sA, sP] = (0, a.useState)(null);
                (0, a.useEffect)(() => {
                    if (sm || sZ) return;
                    let e = document.getElementById("desktop-props-container");
                    if (!e) return;
                    let t = () => {
                        var t;
                        let s = e.querySelector("thead");
                        sP(Math.max(0, e.clientHeight - (null !== (t = null == s ? void 0 : s.offsetHeight) && void 0 !== t ? t : 0)))
                    };
                    t();
                    let s = new ResizeObserver(t);
                    return s.observe(e), () => s.disconnect()
                }, [sm, sZ]);
                let sL = ez ? t3 : sv || sk,
                    sD = !ez && sb,
                    sO = !ez && sC,
                    sz = !ez && sM,
                    sI = (0, a.useMemo)(() => {
                        var e, t;
                        let s = null !== (e = null == t1 ? void 0 : t1.hiddenCounts) && void 0 !== e ? e : {};
                        return eR.length > 1 ? eR.reduce((e, t) => {
                            var r;
                            return e + (null !== (r = s[t]) && void 0 !== r ? r : 0)
                        }, 0) : "all" === eF ? Object.values(s).reduce((e, t) => e + t, 0) : null !== (t = s[eF]) && void 0 !== t ? t : 0
                    }, [null == t1 ? void 0 : t1.hiddenCounts, eR, eF]),
                    sT = (0, a.useMemo)(() => Math.max(0, 10 - sR.length - 1), [sR.length]);
                (0, a.useEffect)(() => {
                    if (!ez || !t1) return;
                    let e = t1.items.length,
                        t = "".concat(eF, ":").concat(e, ":").concat(sI, ":").concat(q ? "signed-in" : "signed-out", ":").concat(null != X ? X : "None", ":").concat(K ? "pwa" : "web");
                    ej.current !== t && (ej.current = t, T.co.trackFreemiumPropsViewed(eq({
                        item_count: e,
                        hidden_count: sI
                    })))
                }, [eq, q, K, sI, t1, ez, eF, X]);
                let sE = (0, a.useCallback)(() => {
                    let e = eb.current,
                        t = null == e ? void 0 : e.querySelector("[data-radix-scroll-area-viewport]");
                    if (!t) return;
                    let s = t.scrollWidth - t.clientWidth,
                        r = t.scrollLeft >= s - 1;
                    eN(s > 1 && !r)
                }, []);
                (0, a.useEffect)(() => {
                    sE();
                    let e = eb.current,
                        t = null == e ? void 0 : e.querySelector("[data-radix-scroll-area-viewport]");
                    if (!t) return;
                    let s = new ResizeObserver(() => sE());
                    return s.observe(t), t.addEventListener("scroll", sE, {
                        passive: !0
                    }), () => {
                        s.disconnect(), t.removeEventListener("scroll", sE)
                    }
                }, [sp, sE]), (0, a.useEffect)(() => {
                    if (!sm) return;
                    let e = new IntersectionObserver(e => {
                        e[0].isIntersecting && !sM && !sk && sR.length > 0 && sN < 100 && sF > sR.length && sy(sN + 1)
                    }, {
                        root: null,
                        rootMargin: "0px",
                        threshold: .1
                    });
                    return tK.current && e.observe(tK.current), () => {
                        tK.current && e.unobserve(tK.current)
                    }
                }, [sN, sM, sk, sR.length, sF, sm]);
                let sU = "all" !== eF.toLowerCase() && e_.ZP[eF].esport,
                    sV = (0, a.useMemo)(() => [{
                        name: "Line",
                        description: "The line set by the betting app",
                        sortId: "line"
                    }, {
                        name: "Apps"
                    }, {
                        name: "Moneyline",
                        description: "Chance the player's team wins the game, implied from sportsbook moneyline odds"
                    }, ...eU.includes(eF) ? ["mlb" === eF ? {
                        name: "K% Rank",
                        description: "How often the opposing lineup strikes out this season (pitcher props only) — 1st strikes out the most, the softest strikeout matchup",
                        sortId: "defenseRank"
                    } : {
                        name: "Defense",
                        description: "How the opponent's defense ranks against this stat — 1st is the toughest matchup, higher is softer",
                        sortId: "defenseRank"
                    }] : [], {
                        name: "IP",
                        sortId: "chances",
                        description: "The implied probability of the player going over/under the line, purely based on the odds (only available for lines that are on multiple books). For the most profitable odds, take over/unders higher than 54.3% and run 5/6 leg parlays."
                    }, {
                        name: "Avg L10",
                        description: "Average over last 10 games"
                    }, {
                        name: "Diff",
                        description: "Difference of projection and average over last 10 games",
                        sortId: "differenceLast10"
                    }, {
                        name: "L5",
                        description: "Percentage of last 5 games going over projection",
                        sortId: "hitRateLast5"
                    }, {
                        name: "L10",
                        description: "Percentage of last 10 games going over projection",
                        sortId: "hitRateLast10"
                    }, {
                        name: "L15",
                        description: "Percentage of last 15 games going over projection",
                        sortId: "hitRateLast15"
                    }, {
                        name: "H2H",
                        description: "Percentage of times this player went over the line vs this opponent",
                        sortId: "hitRateH2H"
                    }, {
                        name: "Strk",
                        description: "Current game streak over projection",
                        sortId: "streak"
                    }, ...eU.includes(eF) || "cod" === eF || "soccer" === eF ? [{
                        name: "SZN",
                        description: "The hit rate of the player in the current season",
                        sortId: "hrSeason"
                    }] : []], [eF]),
                    sB = (0, a.useMemo)(() => ez ? sV.map(e => ({ ...e,
                        sortId: void 0
                    })) : sV, [ez, sV]),
                    sH = sB.filter(e => !e.hideColumn).length,
                    sW = Array.isArray(null === (i = M.sportFilters[eF]) || void 0 === i ? void 0 : i.games) ? null === (o = M.sportFilters[eF]) || void 0 === o ? void 0 : o.games : [],
                    sG = Array.isArray(null === (d = M.sportFilters[eF]) || void 0 === d ? void 0 : d.teams) ? null === (c = M.sportFilters[eF]) || void 0 === c ? void 0 : c.teams : [],
                    sJ = (0, a.useMemo)(() => (function(e) {
                        let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [],
                            s = arguments.length > 2 ? arguments[2] : void 0;
                        if (!(null == e ? void 0 : e.length)) return [];
                        let r = (t.length > 0 ? e.filter(e => t.includes(e.id)) : e).filter(e => !s || e.sport !== s),
                            n = new Map;
                        for (let e of r)
                            for (let t of [e.homeTeam, e.awayTeam]) {
                                if (!(null == t ? void 0 : t.id) && !(null == t ? void 0 : t.abbreviation) && !(null == t ? void 0 : t.name)) continue;
                                let e = (t.id || t.abbreviation || t.name).trim().toUpperCase();
                                n.has(e) || n.set(e, {
                                    key: e,
                                    abbreviation: t.abbreviation || t.name,
                                    name: t.name || t.abbreviation,
                                    image: t.image
                                })
                            }
                        return [...n.values()].sort((e, t) => e.abbreviation.localeCompare(t.abbreviation))
                    })(null == sr ? void 0 : sr.games, sW, "all" === eF ? "tennis" : void 0), [null == sr ? void 0 : sr.games, sW, eF]);
                (0, a.useEffect)(() => {
                    if (!sG.length) return;
                    let e = new Set(sJ.map(e => e.key)),
                        t = sG.filter(t => e.has(t));
                    t.length !== sG.length && z(eF, "teams", t)
                }, [sJ, sG, z, eF]), (0, a.useEffect)(() => {
                    if (!sW.length || so || !(null == sr ? void 0 : sr.games)) return;
                    let e = new Set(sr.games.map(e => e.id)),
                        t = sW.filter(t => e.has(t));
                    t.length !== sW.length && z(eF, "games", t)
                }, [null == sr ? void 0 : sr.games, so, sW, z, eF]);
                let sq = (0, a.useMemo)(() => sJ.map(e => ({
                        value: e.key,
                        label: (0, r.jsxs)("span", {
                            className: "flex min-w-0 flex-col gap-0 leading-[1.15] text-left",
                            children: [(0, r.jsx)("span", {
                                className: "truncate text-xs font-medium text-foreground",
                                title: e.abbreviation,
                                children: tB(e.abbreviation)
                            }), e.name !== e.abbreviation ? (0, r.jsx)("span", {
                                className: "truncate text-[10px] text-muted-foreground",
                                title: e.name,
                                children: tB(e.name)
                            }) : null]
                        }),
                        icon: (0, r.jsx)(em.Z, {
                            abbreviation: e.abbreviation,
                            sport: eF,
                            imageUrl: e.image,
                            size: 20
                        })
                    })), [sJ, eF]),
                    sK = et.length !== F.apps.length || et.some(e => !F.apps.includes(e)),
                    sX = "any" !== en,
                    s$ = [tz, tU, null === (b = M.sportFilters[eF]) || void 0 === b ? void 0 : b.stats.length, sK, sX, sW.length, "tennis" === eF ? 0 : sG.length, tb, tk, tF, e2, "all" !== e6, t_].filter(Boolean).length,
                    sQ = s$ > 0,
                    sY = (0 === sW.length || (1 === sW.length ? null == sr || null === (v = sr.games.find(e => e.id === sW[0])) || void 0 === v || v.title : sW.length), 1 === sW.length ? null == sr ? void 0 : sr.games.find(e => e.id === sW[0]) : null);
                0 === sW.length || 1 === sW.length && (null == sY ? void 0 : sY.homeTeam) && (null == sY ? void 0 : sY.awayTeam) && (sY.sport, sY.awayTeam, sY.homeTeam, sY.startTime, sY.is_live);
                let s0 = ez ? "" : tU,
                    s1 = ez ? F.apps : et,
                    s5 = ez ? "any" : en,
                    s2 = ez ? [] : (null === (j = M.sportFilters[eF]) || void 0 === j ? void 0 : j.stats) || [],
                    s3 = ez ? [] : sW,
                    s4 = ez ? [] : sG,
                    s6 = ez ? void 0 : tz,
                    s8 = ez ? eL.lW : tM,
                    s7 = ez ? "" : t_,
                    s9 = ez ? "" : tt,
                    re = ez ? "" : ti,
                    rt = ez ? eL.qi.oddsSource : tx,
                    rs = ez ? "" : tf,
                    rr = ez ? eL.qi.oddsSide : tg,
                    rn = ez ? "" : tv,
                    ra = ez ? "" : tj,
                    rl = ez ? [] : tw,
                    ri = !ez && e2,
                    ro = ez ? "all" : e6,
                    rd = () => {
                        _("sort", ["-hitRateLast10"], eF), tV(""), z(eF, "stats", []), tA(F.apps), tO("any"), tI(void 0), tE(""), z(eF, "games", []), z(eF, "teams", []), e3(!1), te("all"), tZ(""), U({ ...F.oddsFilter
                        }, eF), B({ ...F.hitRateFilter
                        }, eF), H({ ...F.tennisRankFilter
                        }, eF)
                    },
                    rc = (0, a.useCallback)(function() {
                        var e;
                        let t = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
                        return {
                            version: 1,
                            sport: t ? eF : null,
                            apps: [...et],
                            modifier: en,
                            showAltLines: e2,
                            stats: [...(null === (e = M.sportFilters[eF]) || void 0 === e ? void 0 : e.stats) || []],
                            sort: [...e1],
                            winChanceRange: t_ || "",
                            oddsFilter: { ...M.oddsFilter
                            },
                            hitRateFilter: { ...M.hitRateFilter,
                                columns: [...M.hitRateFilter.columns]
                            },
                            tennisRankFilter: { ...M.tennisRankFilter
                            }
                        }
                    }, [et, en, e2, e1, eF, M.hitRateFilter, M.oddsFilter, M.sportFilters, M.tennisRankFilter, t_]),
                    ru = (0, a.useMemo)(() => tl(rc(!1), F.apps, F.sort), [rc, F.apps, F.sort]),
                    rm = (0, a.useCallback)(e => {
                        let t = e.apps.filter(e => F.apps.includes(e)),
                            s = 0 === e.apps.length ? [] : t.length > 0 ? t : F.apps,
                            r = F.modifiers.includes(e.modifier) ? e.modifier : "any",
                            n = 0,
                            a = [];
                        if (0 === e.stats.length) a = [];
                        else if (null == sr ? void 0 : sr.stats) {
                            let t = new Set(sr.stats);
                            a = e.stats.filter(e => t.has(e)), n = e.stats.length - a.length
                        } else n = e.stats.length;
                        return tn(et, s) || es(s), en !== r && ea(r), W(eF, {
                            sort: e.sort.length > 0 ? e.sort : F.sort,
                            winChanceRange: e4(e.winChanceRange),
                            showAltLines: e.showAltLines,
                            stats: a,
                            oddsFilter: e.oddsFilter,
                            hitRateFilter: e.hitRateFilter,
                            tennisRankFilter: e.tennisRankFilter
                        }), ep.current = !0, n
                    }, [W, null == sr ? void 0 : sr.stats, F.apps, F.modifiers, F.sort, et, en, es, ea, eF]),
                    rp = (0, a.useCallback)(e => {
                        let t = e9(e.payload.sport);
                        if (t && t !== eF) {
                            ek(e), eZ(t), ep.current = !0;
                            return
                        }
                        let s = rm(e.payload);
                        eP.Am.success("".concat(e.name, " applied")), s > 0 && eP.Am.info("".concat(s, " saved stat").concat(1 === s ? "" : "s", " not available for this sport"))
                    }, [rm, eZ, eF]);
                (0, a.useEffect)(() => {
                    if (!ey || so || !sr) return;
                    let e = e9(ey.payload.sport);
                    if (e && e !== eF) return;
                    let t = rm(ey.payload);
                    eP.Am.success("".concat(ey.name, " applied")), t > 0 && eP.Am.info("".concat(t, " saved stat").concat(1 === t ? "" : "s", " not available for this sport")), ek(null)
                }, [rm, sr, so, ey, eF]);
                let rx = (0, a.useCallback)(e => {
                        if ("undefined" == typeof navigator || !navigator.clipboard) {
                            eP.Am.error("Clipboard unavailable");
                            return
                        }
                        try {
                            let t = function(e) {
                                let t = new URL("/props", window.location.origin);
                                return t.searchParams.set(eQ, function(e) {
                                    let t = JSON.stringify(tu(e));
                                    return btoa(Array.from(new TextEncoder().encode(t), e => String.fromCharCode(e)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
                                }(e)), t.toString()
                            }(e);
                            navigator.clipboard.writeText(t).then(() => eP.Am.success("Preset link copied"), () => eP.Am.error("Copy failed"))
                        } catch (e) {
                            console.warn("Failed to copy prop filter preset:", e), eP.Am.error("Copy failed")
                        }
                    }, []),
                    rh = (0, a.useCallback)(async (e, t) => {
                        if (!J) {
                            eP.Am.error("Filter presets are still loading");
                            return
                        }
                        if (!G) {
                            eP.Am.error("Sign in to save filter presets");
                            return
                        }
                        let s = td(el),
                            r = td(e(s));
                        ei(r), ed(!0);
                        try {
                            await G.update({
                                unsafeMetadata: { ...G.unsafeMetadata,
                                    [e$]: r.map(tm)
                                }
                            }), eP.Am.success(t)
                        } catch (e) {
                            console.error("Failed to update prop filter presets:", e), ei(tc(G.unsafeMetadata)), eP.Am.error("Could not save filter presets")
                        } finally {
                            ed(!1)
                        }
                    }, [J, el, G]),
                    rf = (0, a.useCallback)(e => {
                        if (e7(e.name)) {
                            eP.Am.error("Preset names must be ".concat(24, " characters or fewer"));
                            return
                        }
                        let t = rc(e.includeSport);
                        if (!tl(t, F.apps, F.sort)) {
                            eP.Am.error("Select at least one filter to save a preset");
                            return
                        }
                        let s = e8(e.name, eF),
                            r = new Date().toISOString(),
                            n = {
                                version: 1,
                                name: s,
                                id: tp(),
                                createdAt: r,
                                updatedAt: r,
                                payload: t
                            };
                        rh(e => [n, ...e], "Filter preset saved")
                    }, [rc, F.apps, F.sort, eF, rh]),
                    rg = (0, a.useCallback)(e => {
                        rp(e)
                    }, [rp]),
                    rb = (0, a.useCallback)(e => {
                        let {
                            preset: t,
                            includeSport: s
                        } = e, r = new Date().toISOString();
                        rh(e => e.map(e => e.id === t.id ? { ...e,
                            updatedAt: r,
                            payload: rc(s)
                        } : e), "".concat(t.name, " updated"))
                    }, [rc, rh]),
                    rv = (0, a.useCallback)(e => {
                        rh(t => t.filter(t => t.id !== e), "Filter preset deleted")
                    }, [rh]),
                    rj = (0, a.useCallback)(e => {
                        if (e7(e.name)) {
                            eP.Am.error("Preset names must be ".concat(24, " characters or fewer"));
                            return
                        }
                        let t = rc(e.includeSport);
                        if (!tl(t, F.apps, F.sort)) {
                            eP.Am.error("Select at least one filter to copy a preset link");
                            return
                        }
                        rx({
                            version: 1,
                            name: e8(e.name, eF),
                            payload: t
                        })
                    }, [rx, rc, F.apps, F.sort, eF]);
                (0, a.useEffect)(() => {
                    if (!eA || ev.current) return;
                    let e = new URL(window.location.href),
                        t = e.searchParams.get(eQ) || eY.map(t => e.searchParams.get(t)).find(Boolean);
                    if (!t || so || !sr) return;
                    ev.current = !0;
                    let s = function(e) {
                        try {
                            let t = e.replace(/-/g, "+").replace(/_/g, "/"),
                                s = t.padEnd(t.length + (4 - t.length % 4) % 4, "="),
                                r = atob(s),
                                n = Uint8Array.from(r, e => e.charCodeAt(0)),
                                a = JSON.parse(new TextDecoder().decode(n));
                            return to(a)
                        } catch (e) {
                            return console.warn("Failed to decode prop filter preset:", e), null
                        }
                    }(t);
                    for (let t of (s ? rp(s) : eP.Am.error("Invalid preset link"), e.searchParams.delete(eQ), eY)) e.searchParams.delete(t);
                    window.history.replaceState(null, "", "".concat(e.pathname).concat(e.search).concat(e.hash))
                }, [rp, sr, so, eA]);
                let rw = (0, a.useMemo)(() => {
                        var e, t, s;
                        if (!(null == sr ? void 0 : sr.games)) return [];
                        let n = sr.games.filter(e => (null == e ? void 0 : e.id) && (null == e ? void 0 : e.startTime) && (null == e ? void 0 : e.homeTeam) && (null == e ? void 0 : e.awayTeam)),
                            a = "soccer" === eF && n.some(e => e.league);
                        if (a) {
                            let e = new Map;
                            for (let s of n) {
                                let r = null !== (t = s.league) && void 0 !== t ? t : "";
                                e.has(r) || e.set(r, e.size)
                            }
                            n = [...n].sort((t, s) => {
                                var r, n;
                                return e.get(null !== (r = t.league) && void 0 !== r ? r : "") - e.get(null !== (n = s.league) && void 0 !== n ? n : "")
                            })
                        }
                        let l = "tennis" === eF && n.some(e => e.tournament);
                        if (l) {
                            let e = e => {
                                    var t, s;
                                    return null !== (s = ts[null !== (t = e.league) && void 0 !== t ? t : ""]) && void 0 !== s ? s : 9
                                },
                                t = e => {
                                    var t, s;
                                    return "".concat(null !== (t = e.league) && void 0 !== t ? t : "", "|").concat(null !== (s = e.tournament) && void 0 !== s ? s : "")
                                },
                                s = new Map;
                            for (let e of n) {
                                let r = t(e);
                                s.has(r) || s.set(r, s.size)
                            }
                            n = [...n].sort((r, n) => e(r) - e(n) || s.get(t(r)) - s.get(t(n)))
                        }
                        let i = !!(null === (e = e_.ZP[eF]) || void 0 === e ? void 0 : e.esport) && n.some(e => e.tournament);
                        if (i) {
                            let e = new Map;
                            for (let t of n) {
                                let r = null !== (s = t.tournament) && void 0 !== s ? s : "";
                                e.has(r) || e.set(r, e.size)
                            }
                            n = [...n].sort((t, s) => {
                                var r, n;
                                return e.get(null !== (r = t.tournament) && void 0 !== r ? r : "") - e.get(null !== (n = s.tournament) && void 0 !== n ? n : "")
                            })
                        }
                        return n.map(e => {
                            var t, s, n, o;
                            let d = null !== (s = e.sport) && void 0 !== s ? s : eF,
                                c = [e.awayTeam.name, e.awayTeam.abbreviation, e.homeTeam.name, e.homeTeam.abbreviation, ..."soccer" === d && e.league ? [(0, er.F)(e.league)] : [], ..."tennis" === d ? [tr(e.league), null !== (n = e.tournament) && void 0 !== n ? n : ""] : [], ...(null === (t = e_.ZP[d]) || void 0 === t ? void 0 : t.esport) && e.tournament ? [e.tournament] : []].filter(Boolean),
                                u = a ? e.league ? (0, er.F)(e.league) : "Other" : l ? "".concat(tr(e.league), " \xb7 ").concat(e.tournament ? (o = e.tournament).split(",")[0].trim() || o : "Other") : i ? e.tournament || "Other" : void 0;
                            return {
                                label: (0, r.jsx)(tR, {
                                    sport: d,
                                    awayTeam: e.awayTeam,
                                    homeTeam: e.homeTeam,
                                    startTime: e.startTime,
                                    isLive: e.is_live,
                                    showTime: !0,
                                    compact: !1
                                }),
                                value: e.id,
                                searchKeywords: c,
                                ...u ? {
                                    group: u
                                } : {}
                            }
                        })
                    }, [null == sr ? void 0 : sr.games, eF]),
                    rN = (0, a.useMemo)(() => {
                        var e;
                        return (null == sr ? void 0 : null === (e = sr.stats) || void 0 === e ? void 0 : e.map(e => ({
                            label: e,
                            value: e
                        }))) || []
                    }, [null == sr ? void 0 : sr.stats]),
                    ry = M.sportFilters[eF].page;

                function rk() {
                    if (sL) {
                        let e = (0, r.jsx)("div", {
                            className: "grid place-items-center h-full px-6 py-8",
                            children: (0, r.jsxs)("div", {
                                className: "flex flex-col items-center justify-center",
                                children: [(0, r.jsxs)("div", {
                                    className: "relative mb-4",
                                    children: [(0, r.jsx)("div", {
                                        className: "w-16 h-16 rounded-full bg-gradient-to-br from-slate-700/30 to-slate-800/30 border border-slate-600/20 flex items-center justify-center",
                                        children: (0, r.jsx)("svg", {
                                            className: "w-8 h-8 text-slate-400",
                                            fill: "none",
                                            stroke: "currentColor",
                                            viewBox: "0 0 24 24",
                                            children: (0, r.jsx)("path", {
                                                strokeLinecap: "round",
                                                strokeLinejoin: "round",
                                                strokeWidth: 1.5,
                                                d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                            })
                                        })
                                    }), (0, r.jsx)("div", {
                                        className: "absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-red-400/20 to-red-500/20 border border-red-400/30 flex items-center justify-center",
                                        children: (0, r.jsx)("svg", {
                                            className: "w-3 h-3 text-red-400",
                                            fill: "currentColor",
                                            viewBox: "0 0 20 20",
                                            children: (0, r.jsx)("path", {
                                                fillRule: "evenodd",
                                                d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z",
                                                clipRule: "evenodd"
                                            })
                                        })
                                    })]
                                }), (0, r.jsx)("h3", {
                                    className: "text-lg font-medium text-slate-200 mb-2",
                                    children: "Error Loading Projections"
                                }), (0, r.jsx)("div", {
                                    className: "flex gap-3 items-center w-full",
                                    children: (0, r.jsx)("button", {
                                        onClick: () => window.location.reload(),
                                        className: "text-xs w-full px-4 py-2 rounded-lg bg-input-bg border border-input-border text-slate-200 hover:bg-highlight transition-colors",
                                        children: "Refresh Page"
                                    })
                                }), (0, r.jsxs)("p", {
                                    className: "text-xs text-slate-500 mt-4",
                                    children: ["If this persists,", " ", (0, r.jsx)("a", {
                                        href: "https://discord.gg/pickfinder",
                                        className: "text-blue-400 hover:text-blue-300 underline",
                                        children: "contact support"
                                    })]
                                })]
                            })
                        });
                        return sm ? e : (0, r.jsx)("tbody", {
                            children: (0, r.jsx)("tr", {
                                children: (0, r.jsx)("td", {
                                    colSpan: sH,
                                    className: "p-0 align-top",
                                    children: (0, r.jsx)("div", {
                                        className: "w-full min-h-[24rem]",
                                        style: sA ? {
                                            height: sA
                                        } : void 0,
                                        children: e
                                    })
                                })
                            })
                        })
                    }
                    if (!eA || (sD || so || sO) && !sZ) return sm ? (0, r.jsx)(sc, {}) : (0, r.jsx)(sd, {});
                    if (ez && !sZ) {
                        let e = (0, r.jsx)(t$, {
                            sport: eF,
                            hiddenCount: sI,
                            ctaLabel: eI,
                            onUpgrade: eK,
                            rowCount: sT,
                            noPreview: !0
                        });
                        return sm ? (0, r.jsx)("div", {
                            className: "px-0",
                            children: e
                        }) : (0, r.jsx)("tbody", {})
                    }
                    if (!sZ) {
                        let e = sm ? (0, r.jsx)("div", {
                                className: "flex flex-col gap-2 opacity-60",
                                children: (0, r.jsx)(sc, {
                                    count: 12,
                                    pulse: !1
                                })
                            }) : (0, r.jsx)("div", {
                                className: "absolute inset-0 flex flex-col overflow-hidden opacity-60",
                                children: Array.from({
                                    length: 60
                                }).map((e, t) => (0, r.jsx)("div", {
                                    className: "shrink-0 px-4 py-4",
                                    children: (0, r.jsx)("div", {
                                        className: "h-4 w-full rounded-full bg-input-border"
                                    })
                                }, t))
                            }),
                            t = (0, r.jsxs)(r.Fragment, {
                                children: [s$ > 0 && (0, r.jsx)(D.z, {
                                    variant: "secondary",
                                    className: "h-9 rounded-lg border border-input-border bg-input-bg px-3 text-xs text-slate-200 hover:bg-highlight",
                                    onClick: rd,
                                    children: "Clear All Filters"
                                }), "lol" === eF && (0, r.jsx)("p", {
                                    className: "max-w-xs text-center text-xs text-red-500",
                                    children: "Certain Chinese tournaments such as the Demacia Cup may not show as there are no historical stats for those tournaments."
                                }), "val" === eF && (0, r.jsx)("p", {
                                    className: "max-w-xs text-center text-xs text-red-500",
                                    children: "Chinese tournaments may not show as there are no historical stats for those tournaments."
                                }), sU && (0, r.jsx)("p", {
                                    className: "max-w-xs text-center text-xs text-red-500",
                                    children: "If a player only has projections for Maps 1-3 and they don't have enough data playing 3 maps, their projection might not show up."
                                })]
                            }),
                            s = (0, r.jsx)("div", {
                                className: "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden",
                                children: (0, r.jsx)(A.o, {
                                    fill: !0,
                                    icon: V.Z,
                                    title: "No props found",
                                    description: s$ > 0 ? "Nothing matches your ".concat(1 === s$ ? "filter" : "filters", ". Try clearing or widening them.") : "No props are available for ".concat(eF.toUpperCase(), " right now."),
                                    action: t,
                                    ghost: e
                                })
                            });
                        return sm ? s : (0, r.jsx)("tbody", {
                            children: (0, r.jsx)("tr", {
                                children: (0, r.jsx)("td", {
                                    colSpan: sH,
                                    className: "p-0 align-top",
                                    children: (0, r.jsx)("div", {
                                        className: "relative w-full min-h-[24rem] overflow-hidden",
                                        style: sA ? {
                                            height: sA
                                        } : void 0,
                                        children: s
                                    })
                                })
                            })
                        })
                    }
                    let e = sm && sF > 0 && sR.length >= sF;
                    return sm ? (0, r.jsx)(r.Fragment, {
                        children: (0, r.jsx)(sh, {
                            props: sR,
                            isEndReached: e,
                            isPublicPreview: ez,
                            publicFavoriteLabel: eT,
                            onPublicFavorite: e0,
                            footer: ez ? (0, r.jsx)(t$, {
                                sport: eF,
                                hiddenCount: sI,
                                ctaLabel: eI,
                                onUpgrade: eK,
                                rowCount: sT,
                                compact: !0
                            }) : null
                        })
                    }) : (0, r.jsx)("tbody", {
                        children: (0, r.jsx)(si, {
                            props: sR,
                            sport: eF,
                            appsOrder: Y,
                            isPublicPreview: ez,
                            publicFavoriteLabel: eT,
                            onPublicFavorite: e0
                        })
                    })
                }
                return (0, r.jsxs)(r.Fragment, {
                    children: [(0, r.jsx)("div", {
                        className: "flex flex-col gap-1.5 z-10",
                        children: (0, r.jsx)("div", {
                            "aria-disabled": ez,
                            className: "relative",
                            onClickCapture: ez ? e => {
                                e.preventDefault(), e.stopPropagation(), eX()
                            } : void 0,
                            children: (0, r.jsxs)("div", {
                                className: (0, n.Z)("flex flex-col gap-1.5", ez && "pointer-events-none select-none"),
                                children: [(0, r.jsxs)("div", {
                                    className: "flex flex-row gap-1.5 z-10",
                                    children: [!sm && (0, r.jsx)(t0, {
                                        localSearchTerm: s0,
                                        handleSearchChange: tH,
                                        setLocalSearchTerm: tV,
                                        className: "flex-1"
                                    }), sm && (0, r.jsx)("div", {
                                        className: "w-full",
                                        children: (0, r.jsx)("div", {
                                            className: "flex gap-1.5 transition-all duration-300 ease-in-out",
                                            children: ec ? (0, r.jsxs)(r.Fragment, {
                                                children: [(0, r.jsx)(t0, {
                                                    localSearchTerm: s0,
                                                    handleSearchChange: tH,
                                                    setLocalSearchTerm: tV,
                                                    autoFocus: !0
                                                }), (0, r.jsx)(D.z, {
                                                    variant: "secondary",
                                                    size: "icon",
                                                    className: "h-11 w-11 min-w-[2.75rem] aspect-square bg-input-bg border border-input-border rounded-xl flex-shrink-0 hover:bg-highlight hover:border-input transition-colors duration-200",
                                                    onClick: () => eu(!1),
                                                    children: (0, r.jsx)(eh.Z, {
                                                        className: "w-5 h-5 text-muted-foreground"
                                                    })
                                                })]
                                            }) : (0, r.jsxs)("div", {
                                                className: "flex w-full min-w-0 items-center gap-1.5",
                                                children: [sm && (0, r.jsx)(r.Fragment, {
                                                    children: (0, r.jsx)("div", {
                                                        className: "min-w-0 flex-1",
                                                        children: (0, r.jsx)(t7, {
                                                            selectedApps: s1,
                                                            setSelectedApps: tA,
                                                            apps: e_.w$,
                                                            appMap: F.appMap,
                                                            appsOrder: Y,
                                                            setAppsOrder: ee,
                                                            triggerClassName: "!w-full",
                                                            maxCount: 3
                                                        })
                                                    })
                                                }), (0, r.jsxs)(D.z, {
                                                    variant: "secondary",
                                                    size: "icon",
                                                    className: (0, n.Z)("aspect-square h-11 w-11 min-w-[2.75rem] bg-input-bg border border-input-border rounded-xl flex-shrink-0 relative animate-in fade-in slide-in-from-left-2 duration-300", "hover:bg-highlight hover:border-input transition-colors duration-200", s0 && "border-blue-500"),
                                                    onClick: () => eu(!0),
                                                    children: [(0, r.jsx)(ef.Z, {
                                                        className: (0, n.Z)("w-5 h-5 transition-all duration-200", "hover:scale-110", s0 ? "text-blue-500" : "text-muted-foreground")
                                                    }), s0 && (0, r.jsx)("div", {
                                                        className: "absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"
                                                    })]
                                                }), (0, r.jsx)(t5, {
                                                    savedPresets: e5,
                                                    sport: eF,
                                                    allAppsCount: F.apps.length,
                                                    canSaveCurrentPreset: ru,
                                                    onSavePreset: rf,
                                                    onApplyPreset: rg,
                                                    onUpdatePreset: rb,
                                                    onDeletePreset: rv,
                                                    onCopyPreset: rx,
                                                    onCopyCurrent: rj,
                                                    isSaving: eo || !J,
                                                    isMobile: sm,
                                                    triggerClassName: "flex-shrink-0"
                                                })]
                                            })
                                        })
                                    }), !sm && (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)("div", {
                                            className: "min-w-0 flex-1",
                                            children: (0, r.jsx)(t7, {
                                                selectedApps: s1,
                                                setSelectedApps: tA,
                                                apps: e_.w$,
                                                appMap: F.appMap,
                                                appsOrder: Y,
                                                setAppsOrder: ee,
                                                triggerClassName: "!w-full"
                                            })
                                        }), (0, r.jsx)(t5, {
                                            savedPresets: e5,
                                            sport: eF,
                                            allAppsCount: F.apps.length,
                                            canSaveCurrentPreset: ru,
                                            onSavePreset: rf,
                                            onApplyPreset: rg,
                                            onUpdatePreset: rb,
                                            onDeletePreset: rv,
                                            onCopyPreset: rx,
                                            onCopyCurrent: rj,
                                            isSaving: eo || !J,
                                            isMobile: sm,
                                            triggerClassName: "shrink-0"
                                        })]
                                    })]
                                }), sp ? (0, r.jsxs)("div", {
                                    className: "flex min-w-0 items-start gap-1.5",
                                    children: [(0, r.jsxs)(eO.x, {
                                        ref: eb,
                                        className: (0, n.Z)("min-w-0 flex-1", eH, 'after:content-[""] after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-5 after:bg-gradient-to-l after:from-background/70 after:to-transparent after:pointer-events-none after:opacity-0 after:transition-opacity', ew && "after:opacity-100"),
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex w-max flex-row items-center gap-1.5",
                                            children: [(0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(sn, {
                                                    selectedModifier: s5,
                                                    setSelectedModifier: tO,
                                                    modifiers: F.modifiers,
                                                    triggerClassName: "w-max min-w-[160px] whitespace-nowrap"
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(t2, {
                                                    sport: eF,
                                                    statOptions: rN,
                                                    selectedStats: s2,
                                                    setSelectedStats: tD,
                                                    triggerClassName: "w-max min-w-[150px] whitespace-nowrap"
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(t9, {
                                                    sport: eF,
                                                    selectedGames: s3,
                                                    setSelectedGames: tP,
                                                    gameOptions: rw,
                                                    games: null == sr ? void 0 : sr.games,
                                                    triggerClassName: eV
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: "tennis" === eF ? (0, r.jsx)(se, {
                                                    filter: s8,
                                                    setTennisRankFilter: H,
                                                    onFilterChange: () => {
                                                        ep.current = !0
                                                    },
                                                    triggerClassName: "w-max min-w-[265px] whitespace-nowrap"
                                                }) : (0, r.jsx)(ss, {
                                                    sport: eF,
                                                    selectedTeams: s4,
                                                    setSelectedTeams: tL,
                                                    teamOptions: sq,
                                                    availableTeams: sJ,
                                                    triggerClassName: eV
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(sa, {
                                                    date: s6,
                                                    setDate: tI,
                                                    setLocalDate: tE,
                                                    triggerClassName: "w-max min-w-[123px] whitespace-nowrap"
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(st, {
                                                    selectedRange: s7,
                                                    setSelectedRange: tZ,
                                                    onFilterChange: () => {
                                                        ep.current = !0
                                                    },
                                                    triggerClassName: eV
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(t6, {
                                                    sport: eF,
                                                    minOdds: s9,
                                                    maxOdds: re,
                                                    oddsSource: rt,
                                                    oddsApp: rs,
                                                    oddsSide: rr,
                                                    apps: e_.w$,
                                                    appMap: F.appMap,
                                                    appsOrder: Y,
                                                    setOddsFilter: U,
                                                    onFilterChange: () => {
                                                        ep.current = !0
                                                    },
                                                    triggerClassName: "w-max min-w-[239px] whitespace-nowrap"
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(t8, {
                                                    sport: eF,
                                                    minRate: rn,
                                                    maxRate: ra,
                                                    selectedColumns: rl,
                                                    columnOptions: tN,
                                                    setHitRateFilter: B,
                                                    onFilterChange: () => {
                                                        ep.current = !0
                                                    },
                                                    triggerClassName: "w-max min-w-[227px] whitespace-nowrap"
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, r.jsx)(t4, {
                                                    showAltLines: ri,
                                                    setShowAltLines: e3,
                                                    pushProps: ro,
                                                    setPushProps: te,
                                                    triggerClassName: eV
                                                })
                                            })]
                                        }), (0, r.jsx)(eO.B, {
                                            orientation: "horizontal",
                                            className: eW
                                        })]
                                    }), eA && sQ && !ez && (0, r.jsx)(tC, {
                                        onClick: rd,
                                        iconOnly: !0,
                                        className: "shrink-0"
                                    })]
                                }) : (0, r.jsxs)("div", {
                                    className: "flex min-w-0 items-start gap-1.5",
                                    children: [(0, r.jsxs)(eO.x, {
                                        ref: eb,
                                        className: (0, n.Z)("min-w-0 flex-1", eH, 'after:content-[""] after:absolute after:right-0 after:top-0 after:h-full after:w-4 after:bg-gradient-to-l after:from-background/70 after:to-transparent after:pointer-events-none after:opacity-0 after:transition-opacity', ew && "after:opacity-100"),
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex flex-row gap-1.5 [&>*]:flex-shrink-0",
                                            children: [(0, r.jsx)(sn, {
                                                selectedModifier: s5,
                                                setSelectedModifier: tO,
                                                modifiers: F.modifiers,
                                                triggerClassName: "w-max"
                                            }), (0, r.jsx)(t2, {
                                                sport: eF,
                                                statOptions: rN,
                                                selectedStats: s2,
                                                setSelectedStats: tD,
                                                triggerClassName: "w-max"
                                            }), (0, r.jsx)(t9, {
                                                sport: eF,
                                                selectedGames: s3,
                                                setSelectedGames: tP,
                                                gameOptions: rw,
                                                games: null == sr ? void 0 : sr.games,
                                                triggerClassName: "w-max"
                                            }), "tennis" === eF ? (0, r.jsx)(se, {
                                                filter: s8,
                                                setTennisRankFilter: H,
                                                onFilterChange: () => {
                                                    ep.current = !0
                                                },
                                                triggerClassName: eB
                                            }) : (0, r.jsx)(ss, {
                                                sport: eF,
                                                selectedTeams: s4,
                                                setSelectedTeams: tL,
                                                teamOptions: sq,
                                                availableTeams: sJ,
                                                triggerClassName: "w-max"
                                            }), (0, r.jsx)(sa, {
                                                date: s6,
                                                setDate: tI,
                                                setLocalDate: tE,
                                                triggerClassName: "w-max"
                                            }), (0, r.jsx)(st, {
                                                selectedRange: s7,
                                                setSelectedRange: tZ,
                                                onFilterChange: () => {
                                                    ep.current = !0
                                                },
                                                triggerClassName: "w-max"
                                            }), (0, r.jsx)(t6, {
                                                sport: eF,
                                                minOdds: s9,
                                                maxOdds: re,
                                                oddsSource: rt,
                                                oddsApp: rs,
                                                oddsSide: rr,
                                                apps: e_.w$,
                                                appMap: F.appMap,
                                                appsOrder: Y,
                                                setOddsFilter: U,
                                                onFilterChange: () => {
                                                    ep.current = !0
                                                },
                                                triggerClassName: eB
                                            }), (0, r.jsx)(t8, {
                                                sport: eF,
                                                minRate: rn,
                                                maxRate: ra,
                                                selectedColumns: rl,
                                                columnOptions: tN,
                                                setHitRateFilter: B,
                                                onFilterChange: () => {
                                                    ep.current = !0
                                                },
                                                triggerClassName: eB
                                            }), (0, r.jsx)(t4, {
                                                showAltLines: ri,
                                                setShowAltLines: e3,
                                                pushProps: ro,
                                                setPushProps: te,
                                                compact: !1,
                                                triggerClassName: "w-max"
                                            })]
                                        }), (0, r.jsx)(eO.B, {
                                            orientation: "horizontal",
                                            className: eW
                                        })]
                                    }), eA && sQ && !ez && (0, r.jsx)(tC, {
                                        onClick: rd,
                                        iconOnly: !0,
                                        className: "shrink-0"
                                    })]
                                })]
                            })
                        })
                    }), sm ? (0, r.jsxs)(r.Fragment, {
                        children: [!ez && (0, r.jsx)(tW, {
                            tableColumns: sV,
                            sortSettings: e1,
                            setSortSetting: tS
                        }), (0, r.jsx)(sx, {
                            props: sR,
                            isLoading: sO,
                            filtersLoading: so,
                            loadMoreRef: tK,
                            isInfiniteValidating: sz,
                            isFilterChangeRef: ep,
                            children: rk()
                        })]
                    }) : (0, r.jsxs)("div", {
                        className: (0, n.Z)("relative hidden min-h-0 flex-1 overflow-hidden pb-1 md:flex md:flex-col", ez && "gap-2"),
                        children: [(0, r.jsx)(sl, {
                            tableColumns: sB,
                            props: sR,
                            sport: eF,
                            showPaginationSpace: sR.length > 0 && !ez,
                            setSortSetting: tS,
                            isLoading: sD,
                            filtersLoading: so,
                            isFilterChangeRef: ep,
                            isPageChangeRef: ex,
                            fillHeight: !ez,
                            children: rk()
                        }), ez && !sL && !sD && !sO && (0, r.jsx)("div", {
                            className: "shrink-0",
                            children: (0, r.jsx)(t$, {
                                sport: eF,
                                hiddenCount: sI,
                                ctaLabel: eI,
                                onUpgrade: eK,
                                rowCount: sT,
                                noPreview: !sZ
                            })
                        }), !ez && (0, r.jsx)(su, {
                            currentPage: ry,
                            totalPageCount: (null == sf ? void 0 : sf.totalPages) || 1,
                            sport: eF,
                            setSportFilter: z,
                            perPage: tJ,
                            setPerPage: tq,
                            isFilterChangeRef: ex
                        })]
                    }), (0, r.jsx)(O.Ei, {
                        open: eC,
                        onOpenChange: eM,
                        featureName: "All Props",
                        title: "Unlock All Props",
                        description: "Upgrade for every prop, full filters, player pages, and our premium Discord with admin picks.",
                        benefits: I.vR.props,
                        source: "props"
                    })]
                })
            }

            function t$(e) {
                let {
                    sport: t,
                    hiddenCount: s,
                    ctaLabel: n,
                    onUpgrade: a,
                    compact: l,
                    rowCount: i,
                    noPreview: o
                } = e, d = null != i ? i : l ? 4 : 7, c = "all" === t ? "all sports" : t.toUpperCase(), u = (0, r.jsxs)(D.z, {
                    variant: "blue",
                    className: "h-10 !w-full shrink-0 gap-2 rounded-lg px-5 text-xs sm:!w-auto sm:min-w-36",
                    onClick: a,
                    children: [(0, r.jsx)(B.Z, {
                        className: "h-3.5 w-3.5"
                    }), n]
                });
                return (0, r.jsxs)("div", {
                    className: "relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#030712] p-3 shadow-[0_18px_45px_-30px_rgba(52,97,255,0.75)]",
                    children: [(0, r.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,97,255,0.20),transparent_55%)]"
                    }), (0, r.jsxs)("div", {
                        className: "relative z-10 flex flex-col gap-3",
                        children: [(0, r.jsxs)("div", {
                            className: "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                            children: [(0, r.jsxs)("div", {
                                className: "flex min-w-0 items-center gap-3",
                                children: [(0, r.jsx)("div", {
                                    className: "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-blue-200",
                                    children: (0, r.jsx)(B.Z, {
                                        className: "h-5 w-5"
                                    })
                                }), (0, r.jsxs)("div", {
                                    className: "min-w-0 flex-1",
                                    children: [(0, r.jsx)("p", {
                                        className: "text-sm font-semibold text-white",
                                        children: o ? "Premium ".concat(c, " props") : "More props are locked"
                                    }), (0, r.jsx)("p", {
                                        className: "text-xs text-slate-400",
                                        children: s > 0 ? "".concat(s.toLocaleString(), " additional ").concat("all" !== t ? "".concat(t.toUpperCase(), " ") : "", "prop").concat(1 === s ? "" : "s", " available with PickFinder.") : "Unlock the full board when more props are available."
                                    })]
                                })]
                            }), (0, r.jsxs)("div", {
                                className: "flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center",
                                children: [(0, r.jsx)(z.W, {
                                    children: (0, r.jsxs)(D.z, {
                                        variant: "secondary",
                                        className: "h-10 !w-full shrink-0 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-xs text-slate-100 hover:bg-white/[0.08] sm:!w-auto",
                                        children: [(0, r.jsx)(H.Z, {
                                            className: "h-3.5 w-3.5"
                                        }), "Video Guide"]
                                    })
                                }), u]
                            })]
                        }), d > 0 && (0, r.jsx)("div", {
                            className: "grid gap-2",
                            children: Array.from({
                                length: d
                            }).map((e, t) => (0, r.jsxs)("div", {
                                className: "relative overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-center gap-3 opacity-70 blur-[2px]",
                                    children: [(0, r.jsx)("div", {
                                        className: "h-8 w-8 shrink-0 rounded-full bg-slate-600/70"
                                    }), (0, r.jsxs)("div", {
                                        className: "min-w-0 flex-1",
                                        children: [(0, r.jsx)("div", {
                                            className: "mb-1.5 h-2.5 w-32 rounded bg-slate-500/80"
                                        }), (0, r.jsx)("div", {
                                            className: "h-2 w-44 max-w-full rounded bg-slate-700/80"
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "hidden h-7 w-24 rounded bg-slate-700/80 sm:block"
                                    }), (0, r.jsx)("div", {
                                        className: "hidden h-7 w-16 rounded bg-slate-600/70 md:block"
                                    }), (0, r.jsx)("div", {
                                        className: "h-7 w-20 rounded bg-slate-700/80"
                                    })]
                                }), (0, r.jsx)("div", {
                                    className: "pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#030712]/25 to-transparent"
                                })]
                            }, t))
                        })]
                    })]
                })
            }
            let tQ = {
                    prizepicks: "PrizePicks",
                    underdog: "Underdog",
                    dabble: "Dabble"
                },
                tY = e => {
                    var t;
                    return null !== (t = tQ[e]) && void 0 !== t ? t : e
                },
                t0 = (0, a.memo)(function(e) {
                    let {
                        localSearchTerm: t,
                        handleSearchChange: s,
                        setLocalSearchTerm: a,
                        autoFocus: l = !1,
                        className: i
                    } = e;
                    return (0, r.jsxs)("div", {
                        className: (0, n.Z)("relative overflow-hidden w-full rounded-xl bg-input-bg transition-all duration-300 ease-in-out", i),
                        children: [(0, r.jsx)(eZ.I, {
                            className: "pl-10 h-11 rounded-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                            value: t,
                            onChange: s,
                            placeholder: "Search players...",
                            autoFocus: l
                        }), (0, r.jsx)(ef.Z, {
                            className: "absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"
                        }), (0, r.jsx)("div", {
                            className: "absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2",
                            children: t && (0, r.jsx)(eh.Z, {
                                onClick: () => a(""),
                                className: "text-muted-foreground w-4 h-4 cursor-pointer hover:text-foreground hover:scale-110 transition-all duration-200"
                            })
                        })]
                    })
                });

            function t1(e) {
                var t;
                let {
                    sport: s
                } = e;
                return s ? "all" === s ? (0, r.jsx)(N.YIN, {
                    className: "h-4 w-4"
                }) : (null === (t = e_.ZP[s]) || void 0 === t ? void 0 : t.icon) ? (0, r.jsx)(eS.C, {
                    sport: s,
                    size: 22
                }) : (0, r.jsx)(W.Z, {
                    className: "h-4 w-4"
                }) : (0, r.jsx)(W.Z, {
                    className: "h-4 w-4"
                })
            }
            let t5 = (0, a.memo)(function(e) {
                    let {
                        savedPresets: t,
                        sport: s,
                        allAppsCount: l,
                        canSaveCurrentPreset: i,
                        onSavePreset: o,
                        onApplyPreset: d,
                        onUpdatePreset: c,
                        onDeletePreset: u,
                        onCopyPreset: m,
                        onCopyCurrent: p,
                        isSaving: x,
                        isMobile: h,
                        triggerClassName: f
                    } = e, [g, b] = (0, a.useState)(""), [v, j] = (0, a.useState)(!1), w = (0, a.useMemo)(() => ({
                        name: e8(g, s),
                        includeSport: v
                    }), [v, g, s]), N = (0, a.useCallback)(() => {
                        o(w), b("")
                    }, [w, o]);
                    return (0, r.jsxs)(M.J2, {
                        children: [(0, r.jsx)(M.xo, {
                            asChild: !0,
                            children: (0, r.jsx)(D.z, {
                                variant: "secondary",
                                className: (0, n.Z)("h-11 w-11 rounded-xl border !px-0", tj(!1), f),
                                "aria-label": "Filter presets",
                                "aria-busy": x,
                                children: (0, r.jsx)(W.Z, {
                                    className: "h-4 w-4"
                                })
                            })
                        }), (0, r.jsx)(M.yk, {
                            className: "w-[410px] max-w-[calc(100vw-1rem)] max-h-[80vh] overflow-y-auto rounded-xl border border-input bg-card-bg p-3 shadow-2xl",
                            align: "end",
                            onOpenAutoFocus: e => {
                                h && e.preventDefault()
                            },
                            children: (0, r.jsxs)("div", {
                                className: "flex flex-col gap-3",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-center justify-between gap-2",
                                    children: [(0, r.jsxs)("div", {
                                        className: "min-w-0",
                                        children: [(0, r.jsx)("div", {
                                            className: "text-sm font-semibold text-foreground",
                                            children: "Filter Presets"
                                        }), (0, r.jsx)("div", {
                                            className: "text-[11px] text-muted-foreground",
                                            children: "Apps, modifier, stats, sort, odds, hit rate, tennis rank, and optional sport"
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "flex shrink-0 items-center gap-1.5",
                                        children: (0, r.jsxs)(D.z, {
                                            type: "button",
                                            size: "sm",
                                            variant: "secondary",
                                            className: "h-8 rounded-lg px-2 text-xs",
                                            onClick: () => p(w),
                                            disabled: !i,
                                            children: [(0, r.jsx)(G.Z, {
                                                className: "mr-1.5 h-3.5 w-3.5"
                                            }), "Copy Link"]
                                        })
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "rounded-xl border border-input-border bg-input-bg/70 p-3",
                                    children: [(0, r.jsxs)("div", {
                                        className: "mb-2",
                                        children: [(0, r.jsx)("div", {
                                            className: "text-xs font-semibold text-foreground",
                                            children: "Save Current"
                                        }), (0, r.jsx)("p", {
                                            className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
                                            children: "Saves the filters you have active right now. Apply it later or copy a link to share the same setup."
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "grid grid-cols-[1fr_auto] gap-2",
                                        children: [(0, r.jsx)("div", {
                                            className: "flex flex-col",
                                            children: (0, r.jsx)(eZ.I, {
                                                id: "filter-preset-name",
                                                value: g,
                                                maxLength: 24,
                                                onChange: e => b(e.target.value),
                                                placeholder: e6(s),
                                                className: "h-10 rounded-lg border-input-border bg-new-bg text-sm shadow-none"
                                            })
                                        }), (0, r.jsxs)(D.z, {
                                            type: "button",
                                            size: "sm",
                                            variant: "secondary",
                                            className: "h-10 rounded-lg bg-blue-500 px-3 text-white hover:bg-blue-500/90",
                                            onClick: N,
                                            disabled: x || !i,
                                            children: [x ? (0, r.jsx)(eg.Z, {
                                                className: "mr-1.5 h-3.5 w-3.5 animate-spin"
                                            }) : (0, r.jsx)(J.Z, {
                                                className: "mr-1.5 h-3.5 w-3.5"
                                            }), x ? "Saving" : "Save"]
                                        })]
                                    }), (0, r.jsxs)("button", {
                                        type: "button",
                                        role: "checkbox",
                                        "aria-checked": v,
                                        onClick: () => j(e => !e),
                                        className: (0, n.Z)("mt-3 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs shadow-sm transition-all", v ? "border-blue-300/30 bg-blue-500/[0.08] text-foreground" : "border-slate-600/60 bg-[#101521] text-slate-300 hover:border-slate-500 hover:bg-highlight hover:text-foreground"),
                                        children: [(0, r.jsx)("span", {
                                            className: (0, n.Z)("flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border border-input-border", v ? "border-blue-300/60 bg-gradient-to-r from-[#4040FF] to-blue-900 text-blue-300" : "border-slate-500/70 bg-[#182033]"),
                                            children: v && (0, r.jsx)(q.Z, {
                                                className: "h-3.5 w-3.5"
                                            })
                                        }), (0, r.jsx)("span", {
                                            className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-input-border bg-highlight/70 text-foreground",
                                            children: (0, r.jsx)(t1, {
                                                sport: s
                                            })
                                        }), (0, r.jsxs)("span", {
                                            className: "min-w-0 flex-1",
                                            children: ["Save sport ", (0, r.jsx)("span", {
                                                className: "font-semibold text-foreground",
                                                children: te(s)
                                            }), " with this preset", (0, r.jsx)("span", {
                                                className: "mt-0.5 block text-[11px] leading-relaxed text-muted-foreground",
                                                children: "Optional. Leave this off to save only the filters and apply them on whatever sport you are viewing."
                                            })]
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "flex items-center justify-between",
                                    children: [(0, r.jsx)("span", {
                                        className: "text-xs font-semibold text-foreground",
                                        children: "Saved"
                                    }), t.length > 0 && (0, r.jsxs)("span", {
                                        className: "text-[11px] text-muted-foreground",
                                        children: [t.length, " saved"]
                                    })]
                                }), 0 === t.length ? (0, r.jsx)("div", {
                                    className: "rounded-xl border border-dashed border-input-border bg-input-bg/40 px-3 py-5 text-center text-xs text-muted-foreground",
                                    children: "No saved presets yet"
                                }) : (0, r.jsx)(eO.x, {
                                    className: "w-full max-w-[386px] rounded-none",
                                    style: {
                                        height: Math.min(96 * t.length, 260)
                                    },
                                    children: (0, r.jsx)("div", {
                                        className: "flex min-w-0 flex-col gap-2 pr-1",
                                        children: t.map(e => (0, r.jsxs)("div", {
                                            className: "rounded-xl border border-input-border bg-input-bg/50 p-2.5",
                                            children: [(0, r.jsxs)("div", {
                                                className: "flex min-w-0 items-center gap-2",
                                                children: [(0, r.jsx)("span", {
                                                    className: "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-input-border bg-highlight/70 text-foreground shadow-sm",
                                                    children: (0, r.jsx)(t1, {
                                                        sport: e.payload.sport
                                                    })
                                                }), (0, r.jsxs)("div", {
                                                    className: "min-w-0 flex-1",
                                                    children: [(0, r.jsx)("div", {
                                                        className: "truncate text-sm font-semibold text-foreground",
                                                        title: e.name,
                                                        children: e.name
                                                    }), (0, r.jsx)("div", {
                                                        className: "truncate text-[11px] text-muted-foreground",
                                                        title: tx(e, l),
                                                        children: tx(e, l)
                                                    })]
                                                })]
                                            }), (0, r.jsxs)("div", {
                                                className: (0, n.Z)("mt-2 grid gap-1.5", "grid-cols-[1fr_1fr_1fr_36px]"),
                                                children: [(0, r.jsxs)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-8 rounded-lg px-2 text-xs",
                                                    onClick: () => d(e),
                                                    children: [(0, r.jsx)(q.Z, {
                                                        className: "mr-1 h-3.5 w-3.5"
                                                    }), "Apply"]
                                                }), (0, r.jsxs)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-8 rounded-lg px-2 text-xs",
                                                    onClick: () => c({
                                                        preset: e,
                                                        includeSport: v
                                                    }),
                                                    disabled: x,
                                                    children: [(0, r.jsx)(K.Z, {
                                                        className: "mr-1 h-3.5 w-3.5"
                                                    }), v ? "Update + Sport" : "Update"]
                                                }), (0, r.jsxs)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-8 rounded-lg px-2 text-xs",
                                                    onClick: () => m(e),
                                                    children: [(0, r.jsx)(X.Z, {
                                                        className: "mr-1 h-3.5 w-3.5"
                                                    }), "Share"]
                                                }), (0, r.jsx)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-8 rounded-lg border border-red-300/15 bg-red-300/[0.08] px-0 text-red-300 hover:bg-red-300/[0.14] hover:text-red-200",
                                                    "aria-label": "Delete ".concat(e.name),
                                                    onClick: () => u(e.id),
                                                    disabled: x,
                                                    children: (0, r.jsx)(ex.Z, {
                                                        className: "h-3.5 w-3.5"
                                                    })
                                                })]
                                            })]
                                        }, e.id))
                                    })
                                })]
                            })
                        })]
                    })
                }),
                t2 = (0, a.memo)(function(e) {
                    let {
                        statOptions: t,
                        selectedStats: s,
                        setSelectedStats: l,
                        sport: i,
                        triggerClassName: o
                    } = e, d = (0, a.useMemo)(() => t.map(e => e.value), [t]), c = s.length, u = c > 0, m = 0 === c ? "Stats" : 1 === c ? s[0] : "".concat(c, " Stats"), p = (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-2 px-2",
                        children: [u && (0, r.jsx)(tk, {
                            onClear: () => l([])
                        }), (0, r.jsx)(w.oh2, {
                            className: (0, n.Z)("w-4 h-4", tw(u))
                        }), (0, r.jsx)("span", {
                            className: tN(u),
                            children: m
                        })]
                    });
                    return (0, r.jsx)("div", {
                        className: "min-w-0 sm:block",
                        children: (0, r.jsx)(_.N, {
                            options: t,
                            onValueChange: l,
                            selectedValues: s,
                            allValues: d,
                            enableOnlyAction: !0,
                            placeholder: "Stats",
                            noOptionsMessage: "No stats",
                            variant: "secondary",
                            maxCount: 1,
                            showTriggerClear: !1,
                            emptyDisplayLabel: p,
                            customDisplayLabel: p,
                            className: (0, n.Z)("h-11 w-max min-w-[124px]", tj(u), o),
                            triggerActive: u
                        })
                    })
                }),
                t3 = [{
                    value: "all",
                    label: "Show"
                }, {
                    value: "hide",
                    label: "Hide"
                }, {
                    value: "only",
                    label: "Only"
                }],
                t4 = (0, a.memo)(function(e) {
                    let {
                        showAltLines: t,
                        setShowAltLines: s,
                        pushProps: a,
                        setPushProps: l,
                        compact: i = !1,
                        triggerClassName: o
                    } = e, d = t || "all" !== a;
                    return (0, r.jsxs)(M.J2, {
                        children: [(0, r.jsx)(M.xo, {
                            asChild: !0,
                            children: (0, r.jsxs)(D.z, {
                                variant: "secondary",
                                className: (0, n.Z)("h-11 rounded-xl border flex items-center justify-between !px-3.5", tj(d), o),
                                "aria-label": "Alt Lines",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                    children: [d && (0, r.jsx)(tk, {
                                        onClear: () => {
                                            s(!1), l("all")
                                        }
                                    }), d ? (0, r.jsx)($.Z, {
                                        className: tw(d)
                                    }) : (0, r.jsx)(Q.Z, {
                                        className: tw(d)
                                    }), !i && (0, r.jsx)("span", {
                                        className: tN(d),
                                        children: "Alt Lines"
                                    })]
                                }), (0, r.jsx)(Y.Z, {
                                    className: ty(d)
                                })]
                            })
                        }), (0, r.jsx)(M.yk, {
                            className: "w-64 bg-card-bg border border-input rounded-xl shadow-2xl p-4",
                            children: (0, r.jsxs)("div", {
                                className: "flex flex-col gap-4",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-center justify-between",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex flex-col gap-0.5",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-sm font-medium text-foreground",
                                            children: "Alt Filter"
                                        }), (0, r.jsx)("span", {
                                            className: "text-xs text-muted-foreground",
                                            children: "Include alternate betting lines"
                                        })]
                                    }), (0, r.jsx)("button", {
                                        onClick: () => s(!t),
                                        className: (0, n.Z)("relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg", t ? "bg-blue-500" : "bg-input-border"),
                                        children: (0, r.jsx)("span", {
                                            className: (0, n.Z)("inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200", t ? "translate-x-6" : "translate-x-1")
                                        })
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "text-xs text-muted-foreground leading-relaxed border-t border-input-border pt-3",
                                    children: ["When enabled, shows additional lines from sportsbooks beyond the main line.", " ", (0, r.jsx)("span", {
                                        className: "text-blue-500",
                                        children: "Does not apply to Pick'Em app lines."
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "flex flex-col gap-2 border-t border-input-border pt-4",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex flex-col gap-0.5",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-sm font-medium text-foreground",
                                            children: "Push Props"
                                        }), (0, r.jsx)("span", {
                                            className: "text-xs text-muted-foreground",
                                            children: "Lines that can push (whole numbers)"
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "grid grid-cols-3 gap-1 rounded-lg bg-input-bg p-1",
                                        children: t3.map(e => (0, r.jsx)("button", {
                                            onClick: () => l(e.value),
                                            "aria-pressed": a === e.value,
                                            className: (0, n.Z)("rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg", a === e.value ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"),
                                            children: e.label
                                        }, e.value))
                                    })]
                                })]
                            })
                        })]
                    })
                }),
                t6 = (0, a.memo)(function(e) {
                    let {
                        sport: t,
                        minOdds: s,
                        maxOdds: l,
                        oddsSource: i,
                        oddsApp: o,
                        oddsSide: d,
                        apps: c,
                        appMap: u,
                        appsOrder: m,
                        setOddsFilter: p,
                        onFilterChange: x,
                        triggerClassName: h,
                        compact: f = !1
                    } = e, [g, b] = (0, a.useState)(s), [j, w] = (0, a.useState)(l), N = (0, a.useRef)({
                        min: s,
                        max: l
                    });
                    (0, a.useEffect)(() => {
                        b(s), N.current.min = s
                    }, [s]), (0, a.useEffect)(() => {
                        w(l), N.current.max = l
                    }, [l]);
                    let y = (0, a.useMemo)(() => {
                            let e = new Set(c);
                            return [...m.filter(t => e.has(t)), ...c.filter(e => !m.includes(e))]
                        }, [c, m]),
                        k = (0, a.useMemo)(() => y.filter(e => !eq[e]), [y]),
                        C = o && !eq[o] ? o : k[0] || "",
                        _ = !!(g || j || "app" === i || "either" !== d),
                        S = function(e, t) {
                            let s = tb(e),
                                r = tb(t);
                            return s && r ? "".concat(s, " to ").concat(r) : s ? "".concat(s, "+") : r ? "up to ".concat(r) : ""
                        }(g, j),
                        R = "either" === d ? "Either" : "over" === d ? "Overs" : "Unders",
                        Z = (0, a.useMemo)(() => {
                            let e = Number(g),
                                t = Number(j);
                            return Number.isFinite(e) && e < -400 || Number.isFinite(t) && t > 400
                        }, [j, g]),
                        A = (0, a.useMemo)(() => eu()((e, s) => {
                            p({
                                minOdds: e,
                                maxOdds: s
                            }, t), null == x || x()
                        }, 300), [x, p, t]);
                    (0, a.useEffect)(() => () => {
                        A.cancel()
                    }, [A]), (0, a.useEffect)(() => {
                        "app" === i && o && eq[o] && C && p({
                            oddsApp: C
                        }, t)
                    }, [o, i, C, p, t]);
                    let P = (0, a.useCallback)(e => {
                            p({
                                oddsSource: e,
                                ..."app" === e && C && (!o || eq[o]) ? {
                                    oddsApp: C
                                } : {}
                            }, t), null == x || x()
                        }, [o, x, C, p, t]),
                        L = (0, a.useCallback)(e => {
                            p({
                                oddsSide: e
                            }, t), null == x || x()
                        }, [x, p, t]),
                        O = (0, a.useCallback)(e => {
                            eq[e] || (p({
                                oddsApp: e
                            }, t), null == x || x())
                        }, [x, p, t]),
                        z = (0, a.useCallback)(e => {
                            let t = e.replace(/^\+/, ""),
                                s = N.current.max;
                            N.current = {
                                min: t,
                                max: s
                            }, b(t), A(t, s)
                        }, [A]),
                        I = (0, a.useCallback)(e => {
                            let t = e.replace(/^\+/, ""),
                                s = N.current.min;
                            N.current = {
                                min: s,
                                max: t
                            }, w(t), A(s, t)
                        }, [A]),
                        T = (0, a.useCallback)(e => {
                            let [t, s] = e, r = String(t), n = String(s);
                            N.current = {
                                min: r,
                                max: n
                            }, b(r), w(n), A(r, n)
                        }, [A]),
                        E = (0, a.useCallback)(() => {
                            A.cancel(), N.current = {
                                min: "",
                                max: ""
                            }, b(""), w(""), p({
                                minOdds: "",
                                maxOdds: "",
                                oddsSource: "best",
                                oddsApp: "",
                                oddsSide: "either"
                            }, t), null == x || x()
                        }, [A, x, p, t]),
                        U = (0, a.useMemo)(() => {
                            let e = e => Math.max(-1e3, Math.min(1e3, e)),
                                t = (t, s) => {
                                    let r = Number(t);
                                    return Number.isFinite(r) ? e(r) : s
                                },
                                s = t(g, -1e3),
                                r = t(j, 1e3);
                            return s > r && ([s, r] = [r, s]), s === r && (s = Math.max(-1e3, (r = Math.min(1e3, s + 60)) - 60)), [s, r]
                        }, [j, g]);
                    return (0, r.jsx)("div", {
                        children: (0, r.jsxs)(M.J2, {
                            children: [(0, r.jsx)(M.xo, {
                                asChild: !0,
                                children: (0, r.jsxs)(D.z, {
                                    variant: "secondary",
                                    className: (0, n.Z)("h-11 rounded-xl border flex items-center justify-between !px-3.5", tj(_), h),
                                    "aria-label": "Odds filter",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                        children: [_ && (0, r.jsx)(tk, {
                                            onClear: E
                                        }), (0, r.jsx)(v.kvo, {
                                            className: (0, n.Z)("w-4 h-4", tw(_))
                                        }), (0, r.jsx)("span", {
                                            className: (0, n.Z)(tN(_), "app" === i && _ && "inline-flex items-center gap-1.5"),
                                            children: _ ? "app" === i && C ? (0, r.jsxs)(r.Fragment, {
                                                children: [(0, r.jsx)(F.Z, {
                                                    appName: C,
                                                    size: 18
                                                }), (0, r.jsxs)("span", {
                                                    children: [R, S ? " ".concat(S) : ""]
                                                })]
                                            }) : "".concat(R).concat(S ? " ".concat(S) : "") : "Min/Max Odds"
                                        })]
                                    }), (0, r.jsx)(Y.Z, {
                                        className: ty(_)
                                    })]
                                })
                            }), (0, r.jsx)(M.yk, {
                                className: "w-[340px] bg-card-bg border border-input rounded-xl shadow-2xl p-3",
                                align: "start",
                                children: (0, r.jsxs)("div", {
                                    className: "flex flex-col gap-3",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex items-center justify-between",
                                        children: [(0, r.jsxs)("div", {
                                            children: [(0, r.jsx)("div", {
                                                className: "text-sm font-semibold text-foreground",
                                                children: "Min/Max Odds"
                                            }), (0, r.jsx)("div", {
                                                className: "text-[11px] text-muted-foreground",
                                                children: function(e) {
                                                    let {
                                                        source: t,
                                                        app: s,
                                                        appMap: r,
                                                        side: n,
                                                        min: a,
                                                        max: l
                                                    } = e, i = "app" === t && s ? r[s] || s : "Best", o = "either" === n ? "Either" : "over" === n ? "Overs" : "Unders", d = tb(a), c = tb(l);
                                                    return d && c ? "".concat(i, " ").concat(o, " ").concat(d, " to ").concat(c) : d ? "".concat(i, " ").concat(o, " ").concat(d, "+") : c ? "".concat(i, " ").concat(o, " up to ").concat(c) : "".concat(i, " ").concat(o)
                                                }({
                                                    source: i,
                                                    app: C,
                                                    appMap: u,
                                                    side: d,
                                                    min: g,
                                                    max: j
                                                })
                                            })]
                                        }), (0, r.jsx)(D.z, {
                                            size: "sm",
                                            variant: "secondary",
                                            className: "h-7 px-2 rounded-lg text-xs",
                                            onClick: E,
                                            children: "Clear"
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "grid grid-cols-2 gap-1 rounded-xl border border-input-border bg-input-bg/70 p-1",
                                        children: [{
                                            value: "best",
                                            label: "Best",
                                            description: "Across selected apps"
                                        }, {
                                            value: "app",
                                            label: "Sportsbook",
                                            description: "One app only"
                                        }].map(e => (0, r.jsxs)("button", {
                                            type: "button",
                                            onClick: () => P(e.value),
                                            className: (0, n.Z)("rounded-lg px-2.5 py-2 text-left transition-all", i === e.value ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:bg-highlight hover:text-foreground"),
                                            children: [(0, r.jsx)("div", {
                                                className: "text-xs font-semibold leading-none",
                                                children: e.label
                                            }), (0, r.jsx)("div", {
                                                className: (0, n.Z)("mt-1 text-[10px]", i === e.value ? "text-blue-100" : ""),
                                                children: e.description
                                            })]
                                        }, e.value))
                                    }), "app" === i && (0, r.jsxs)("div", {
                                        className: "rounded-xl border border-input-border bg-input-bg/50 p-2",
                                        children: [(0, r.jsxs)("div", {
                                            className: "mb-2 flex items-center justify-between gap-2",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xs font-medium text-muted-foreground",
                                                children: "Sportsbook"
                                            }), C && (0, r.jsxs)("span", {
                                                className: "flex items-center gap-1.5 rounded-full border border-input-border bg-highlight/70 px-2 py-1 text-[11px] text-foreground",
                                                children: [(0, r.jsx)(F.Z, {
                                                    appName: C,
                                                    size: 16
                                                }), u[C] || C]
                                            })]
                                        }), (0, r.jsxs)(eR.Ph, {
                                            value: C,
                                            onValueChange: O,
                                            children: [(0, r.jsx)(eR.i4, {
                                                className: "h-10 rounded-lg border-input-border bg-new-bg px-3 text-xs",
                                                children: (0, r.jsx)(eR.ki, {
                                                    placeholder: "Choose app"
                                                })
                                            }), (0, r.jsx)(eR.Bw, {
                                                children: y.map(e => {
                                                    let t = eq[e];
                                                    return (0, r.jsx)(eR.Ql, {
                                                        value: e,
                                                        disabled: !!t,
                                                        children: (0, r.jsxs)("div", {
                                                            className: "flex w-full items-center gap-2",
                                                            children: [(0, r.jsx)(F.Z, {
                                                                appName: e,
                                                                size: 18
                                                            }), (0, r.jsx)("span", {
                                                                className: "min-w-0 flex-1 truncate",
                                                                children: u[e] || e
                                                            }), t && (0, r.jsx)("span", {
                                                                className: "ml-auto rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200",
                                                                children: t
                                                            })]
                                                        })
                                                    }, e)
                                                })
                                            })]
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "grid grid-cols-3 gap-1 rounded-xl border border-input-border bg-input-bg/70 p-1",
                                        children: [{
                                            value: "either",
                                            label: "Either"
                                        }, {
                                            value: "over",
                                            label: "Overs"
                                        }, {
                                            value: "under",
                                            label: "Unders"
                                        }].map(e => (0, r.jsx)("button", {
                                            type: "button",
                                            onClick: () => L(e.value),
                                            className: (0, n.Z)("h-9 rounded-lg text-xs font-semibold transition-all", d === e.value ? "under" === e.value ? "bg-red-500/90 text-white" : "over" === e.value ? "bg-green-500/90 text-white" : "bg-blue-500 text-white" : "text-muted-foreground hover:bg-highlight hover:text-foreground"),
                                            children: e.label
                                        }, e.value))
                                    }), (0, r.jsxs)("div", {
                                        className: "grid grid-cols-2 gap-2",
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("div", {
                                                className: "text-xs text-muted-foreground",
                                                children: "From"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "+100",
                                                value: tb(g),
                                                onChange: e => z(e.target.value),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("div", {
                                                className: "text-xs text-muted-foreground",
                                                children: "To"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "+250",
                                                value: tb(j),
                                                onChange: e => I(e.target.value),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "rounded-xl border border-input-border bg-input-bg/40 px-3 pb-3 pt-2",
                                        children: [(0, r.jsx)(eA.i, {
                                            min: -1e3,
                                            max: 1e3,
                                            step: 10,
                                            minStepsBetweenThumbs: 6,
                                            value: U,
                                            debounceMs: 0,
                                            onValueChange: T,
                                            hideThumbLabels: !0,
                                            className: "pb-2 pt-3"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex justify-between text-[10px] text-muted-foreground",
                                            children: [(0, r.jsx)("span", {
                                                children: -1e3
                                            }), (0, r.jsx)("span", {
                                                children: "EVEN"
                                            }), (0, r.jsxs)("span", {
                                                children: ["+", 1e3]
                                            })]
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "rounded-xl border border-blue-400/10 bg-blue-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
                                        children: "best" === i ? "Best mode checks the best over and/or under price across any app on the prop." : "Sportsbook mode only checks ".concat(u[C] || C || "the selected app", " odds.")
                                    }), Z && (0, r.jsx)("div", {
                                        className: "rounded-xl border border-amber-300/15 bg-amber-300/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber-100/80",
                                        children: "Looking for odds this far out? Enable Alt Lines to the right to include more lines in this range."
                                    })]
                                })
                            })]
                        })
                    })
                }),
                t8 = (0, a.memo)(function(e) {
                    let {
                        sport: t,
                        minRate: s,
                        maxRate: l,
                        selectedColumns: i,
                        columnOptions: o,
                        setHitRateFilter: d,
                        onFilterChange: c,
                        triggerClassName: u
                    } = e, [m, p] = (0, a.useState)(s), [x, h] = (0, a.useState)(l), f = (0, a.useRef)({
                        min: s,
                        max: l
                    });
                    (0, a.useEffect)(() => {
                        p(s), f.current.min = s
                    }, [s]), (0, a.useEffect)(() => {
                        h(l), f.current.max = l
                    }, [l]);
                    let g = (0, a.useMemo)(() => {
                            let e = new Set(o.map(e => e.id));
                            return i.filter(t => e.has(t))
                        }, [o, i]),
                        b = function(e, t) {
                            let s = e.trim(),
                                r = t.trim();
                            return s && r ? "".concat(s, "-").concat(r, "%") : s ? "".concat(s, "%+") : r ? "<= ".concat(r, "%") : ""
                        }(m, x),
                        j = !!((m || x) && g.length > 0),
                        w = (0, a.useMemo)(() => {
                            let e = new Map(o.map(e => [e.id, e.label]));
                            return g.map(t => e.get(t) || t)
                        }, [g, o]),
                        N = w.length > 0 ? "".concat(w.slice(0, 2).join(", ")).concat(w.length > 2 ? " +".concat(w.length - 2) : "") : "Hit Rate",
                        y = "".concat(N).concat(b ? " ".concat(b) : ""),
                        k = g.length > 0 ? "".concat(g.length, " column").concat(1 === g.length ? "" : "s").concat(b ? ", ".concat(b) : "") : b || "Select columns and range",
                        C = (0, a.useMemo)(() => eu()((e, s) => {
                            d({
                                min: e,
                                max: s
                            }, t), null == c || c()
                        }, 300), [c, d, t]);
                    (0, a.useEffect)(() => () => {
                        C.cancel()
                    }, [C]);
                    let F = (0, a.useCallback)(e => {
                            let s = {
                                columns: e
                            };
                            e.length > 0 && function(e, t) {
                                let s = e.trim(),
                                    r = t.trim();
                                return !s && !r || s === eK && r === eK
                            }(f.current.min, f.current.max) && (s.min = eK, s.max = eX, f.current = {
                                min: s.min,
                                max: s.max
                            }, p(s.min), h(s.max)), d(s, t), null == c || c()
                        }, [c, d, t]),
                        _ = (0, a.useCallback)(e => {
                            let t = new Set(g);
                            t.has(e) ? t.delete(e) : t.add(e), F(o.map(e => e.id).filter(e => t.has(e)))
                        }, [g, o, F]),
                        S = e => e.replace(/[^\d.]/g, ""),
                        R = (0, a.useCallback)(e => {
                            let t = S(e),
                                s = f.current.max;
                            f.current = {
                                min: t,
                                max: s
                            }, p(t), C(t, s)
                        }, [C]),
                        Z = (0, a.useCallback)(e => {
                            let t = S(e),
                                s = f.current.min;
                            f.current = {
                                min: s,
                                max: t
                            }, h(t), C(s, t)
                        }, [C]),
                        A = (0, a.useCallback)(e => {
                            let [t, s] = e, r = String(t), n = String(s);
                            f.current = {
                                min: r,
                                max: n
                            }, p(r), h(n), C(r, n)
                        }, [C]),
                        P = (0, a.useCallback)(() => {
                            C.cancel(), f.current = {
                                min: "",
                                max: ""
                            }, p(""), h(""), d({
                                min: "",
                                max: "",
                                columns: []
                            }, t), null == c || c()
                        }, [C, c, d, t]),
                        L = (0, a.useMemo)(() => {
                            let e = e => Math.max(0, Math.min(100, e)),
                                t = (t, s) => {
                                    let r = Number(t);
                                    return Number.isFinite(r) ? e(r) : s
                                },
                                s = t(m, 0),
                                r = t(x, 100);
                            return s > r && ([s, r] = [r, s]), s === r && (s = Math.max(0, (r = Math.min(100, s + 7)) - 7)), [s, r]
                        }, [x, m]);
                    return (0, r.jsx)("div", {
                        children: (0, r.jsxs)(M.J2, {
                            children: [(0, r.jsx)(M.xo, {
                                asChild: !0,
                                children: (0, r.jsxs)(D.z, {
                                    variant: "secondary",
                                    className: (0, n.Z)("h-11 rounded-xl border flex items-center justify-between", "!px-3.5 min-w-0", tj(j), u),
                                    "aria-label": "Hit rate filter",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                        children: [j && (0, r.jsx)(tk, {
                                            onClear: P
                                        }), (0, r.jsx)(v.ASK, {
                                            className: (0, n.Z)("w-4 h-4", tw(j))
                                        }), (0, r.jsx)("span", {
                                            className: tN(j),
                                            children: y
                                        })]
                                    }), (0, r.jsx)(Y.Z, {
                                        className: ty(j)
                                    })]
                                })
                            }), (0, r.jsx)(M.yk, {
                                className: "w-[340px] bg-card-bg border border-input rounded-xl shadow-2xl p-3",
                                align: "start",
                                children: (0, r.jsxs)("div", {
                                    className: "flex flex-col gap-3",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex items-center justify-between",
                                        children: [(0, r.jsxs)("div", {
                                            children: [(0, r.jsx)("div", {
                                                className: "text-sm font-semibold text-foreground",
                                                children: "Hit Rate Between"
                                            }), (0, r.jsx)("div", {
                                                className: "text-[11px] text-muted-foreground",
                                                children: k
                                            })]
                                        }), j && (0, r.jsx)(D.z, {
                                            size: "sm",
                                            variant: "secondary",
                                            className: "h-7 px-2 rounded-lg text-xs",
                                            onClick: P,
                                            children: "Clear"
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "grid grid-cols-5 gap-1 rounded-xl border border-input-border bg-input-bg/70 p-1",
                                        children: o.map(e => {
                                            let t = g.includes(e.id);
                                            return (0, r.jsx)("button", {
                                                type: "button",
                                                onClick: () => _(e.id),
                                                className: (0, n.Z)("h-9 rounded-lg text-xs font-semibold transition-all", t ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:bg-highlight hover:text-foreground"),
                                                children: e.label
                                            }, e.id)
                                        })
                                    }), (0, r.jsxs)("div", {
                                        className: "grid grid-cols-2 gap-2",
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("div", {
                                                className: "text-xs text-muted-foreground",
                                                children: "From"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "55",
                                                value: m,
                                                onChange: e => R(e.target.value),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("div", {
                                                className: "text-xs text-muted-foreground",
                                                children: "To"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "100",
                                                value: x,
                                                onChange: e => Z(e.target.value),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "rounded-xl border border-input-border bg-input-bg/40 px-3 pb-3 pt-2",
                                        children: [(0, r.jsx)(eA.i, {
                                            min: 0,
                                            max: 100,
                                            step: 1,
                                            minStepsBetweenThumbs: 7,
                                            value: L,
                                            debounceMs: 0,
                                            onValueChange: A,
                                            hideThumbLabels: !0,
                                            className: "pb-2 pt-3"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex justify-between text-[10px] text-muted-foreground",
                                            children: [(0, r.jsx)("span", {
                                                children: "0%"
                                            }), (0, r.jsx)("span", {
                                                children: "50%"
                                            }), (0, r.jsx)("span", {
                                                children: "100%"
                                            })]
                                        })]
                                    }), (0, r.jsx)("div", {
                                        className: "rounded-xl border border-blue-400/10 bg-blue-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
                                        children: "Empty column selection means all available hit-rate columns for this sport."
                                    })]
                                })
                            })]
                        })
                    })
                }),
                t7 = (0, a.memo)(function(e) {
                    let {
                        selectedApps: t,
                        setSelectedApps: s,
                        apps: a,
                        appMap: l,
                        appsOrder: i,
                        setAppsOrder: o,
                        triggerClassName: d,
                        maxCount: c
                    } = e;
                    return (0, r.jsx)(_.N, {
                        draggable: !0,
                        enableOnlyAction: !0,
                        displayOrder: i,
                        options: i.map(e => ({
                            label: l[e] || e,
                            value: e,
                            icon: (0, r.jsx)(F.Z, {
                                appName: e,
                                size: 20
                            }, "".concat(e, "-m"))
                        })) || [],
                        onOptionsReorder: e => {
                            o(e.map(e => e.value))
                        },
                        onValueChange: s,
                        selectedValues: t,
                        allValues: a || [],
                        placeholder: "Apps",
                        variant: "secondary",
                        maxCount: c || 7,
                        className: (0, n.Z)("h-11 w-1/3", d)
                    })
                }),
                t9 = (0, a.memo)(function(e) {
                    let {
                        setSelectedGames: t,
                        gameOptions: s,
                        selectedGames: l,
                        games: i,
                        sport: o,
                        triggerClassName: d,
                        maxDisplay: c = 1
                    } = e, u = (0, a.useMemo)(() => s.map(e => e.value), [s]), m = l.length > 0, p = 0 === l.length ? "Games" : "".concat(l.length, " ").concat(1 === l.length ? "Game" : "Games"), x = (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-2 px-2",
                        children: [m && (0, r.jsx)(tk, {
                            onClear: () => t([])
                        }), (0, r.jsx)(b.i8F, {
                            size: 25,
                            className: (0, n.Z)("w-5 h-5", tw(m))
                        }), (0, r.jsx)("span", {
                            className: tN(m),
                            children: p
                        })]
                    }), h = m && i ? (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-1.5 overflow-hidden px-1.5",
                        children: [(0, r.jsx)(tk, {
                            onClear: () => t([])
                        }), (0, r.jsx)("div", {
                            className: "min-w-0 flex-1 overflow-hidden",
                            children: (0, r.jsx)(tV, {
                                selectedGameIds: l,
                                games: i,
                                sport: o,
                                maxDisplay: c
                            })
                        })]
                    }) : x;
                    return (0, r.jsx)("div", {
                        children: (0, r.jsx)(_.N, {
                            options: s || [],
                            selectedValues: l,
                            allValues: u,
                            onValueChange: t,
                            placeholder: "All Games",
                            noOptionsMessage: "No games",
                            variant: "secondary",
                            hideSelectAll: !0,
                            maxCount: 1,
                            showTriggerClear: !1,
                            className: (0, n.Z)("h-11 w-max min-w-[132px]", tj(m), d),
                            popoverContentClassName: "max-w-md",
                            triggerActive: m,
                            emptyDisplayLabel: x,
                            customDisplayLabel: h
                        })
                    })
                }),
                se = (0, a.memo)(function(e) {
                    let {
                        filter: t,
                        setTennisRankFilter: s,
                        onFilterChange: l,
                        triggerClassName: i
                    } = e, [o, d] = (0, a.useState)(t), c = (0, a.useRef)(t);
                    (0, a.useEffect)(() => {
                        d(t), c.current = t
                    }, [t]);
                    let u = !!(o.playerRankMin || o.playerRankMax || o.rankDiffMin || o.rankDiffMax),
                        m = function(e, t) {
                            let s = e.trim(),
                                r = t.trim();
                            return s && r ? "#".concat(s, "-#").concat(r) : s ? "#".concat(s, "+") : r ? "<= #".concat(r) : ""
                        }(o.playerRankMin, o.playerRankMax),
                        p = function(e, t) {
                            let s = e.trim(),
                                r = t.trim();
                            return s && r ? "".concat(s, "-").concat(r) : s ? "".concat(s, "+") : r ? "<= ".concat(r) : ""
                        }(o.rankDiffMin, o.rankDiffMax),
                        x = u ? [m, p && "Diff ".concat(p)].filter(Boolean).join(" / ") : "Ranks",
                        h = (0, a.useMemo)(() => eu()(e => {
                            s(e, "tennis"), null == l || l()
                        }, 300), [l, s]);
                    (0, a.useEffect)(() => () => {
                        h.cancel()
                    }, [h]);
                    let f = (0, a.useCallback)(e => {
                            let t = { ...c.current,
                                ...e
                            };
                            c.current = t, d(t), h(t)
                        }, [h]),
                        g = (0, a.useCallback)(() => {
                            let e = {
                                playerRankMin: "",
                                playerRankMax: "",
                                rankDiffMin: "",
                                rankDiffMax: ""
                            };
                            h.cancel(), c.current = e, d(e), s(e, "tennis"), null == l || l()
                        }, [h, l, s]),
                        b = (0, a.useCallback)(() => {
                            f({
                                playerRankMin: "",
                                playerRankMax: ""
                            })
                        }, [f]),
                        j = (0, a.useCallback)(() => {
                            f({
                                rankDiffMin: "",
                                rankDiffMax: ""
                            })
                        }, [f]),
                        w = e => e.replace(/[^\d]/g, ""),
                        N = (e, t, s) => Math.max(t, Math.min(s, e)),
                        y = (e, t, s, r) => {
                            let n = Number(e);
                            return Number.isFinite(n) ? N(n, s, r) : t
                        },
                        k = (0, a.useMemo)(() => {
                            let e = y(o.playerRankMin, 1, 1, 500),
                                t = y(o.playerRankMax, 500, 1, 500);
                            return e > t && ([e, t] = [t, e]), e === t && (e = Math.max(1, (t = Math.min(500, e + 10)) - 10)), [e, t]
                        }, [o.playerRankMax, o.playerRankMin]),
                        C = (0, a.useMemo)(() => {
                            let e = y(o.rankDiffMin, 0, 0, 500),
                                t = y(o.rankDiffMax, 500, 0, 500);
                            return e > t && ([e, t] = [t, e]), e === t && (e = Math.max(0, (t = Math.min(500, e + 10)) - 10)), [e, t]
                        }, [o.rankDiffMax, o.rankDiffMin]);
                    return (0, r.jsx)("div", {
                        children: (0, r.jsxs)(M.J2, {
                            children: [(0, r.jsx)(M.xo, {
                                asChild: !0,
                                children: (0, r.jsxs)(D.z, {
                                    variant: "secondary",
                                    className: (0, n.Z)("h-11 rounded-xl border flex items-center justify-between", "min-w-0", tj(u), u ? (0, n.Z)("!px-3.5", i) : "!px-5 w-max whitespace-nowrap"),
                                    "aria-label": "Tennis rank filter",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                        children: [u && (0, r.jsx)(tk, {
                                            onClear: g
                                        }), (0, r.jsx)(v.PIe, {
                                            className: (0, n.Z)("w-4 h-4", tw(u))
                                        }), (0, r.jsx)("span", {
                                            className: tN(u),
                                            children: x
                                        })]
                                    }), (0, r.jsx)(Y.Z, {
                                        className: ty(u)
                                    })]
                                })
                            }), (0, r.jsx)(M.yk, {
                                className: "w-[360px] bg-card-bg border border-input rounded-xl shadow-2xl p-3",
                                align: "start",
                                children: (0, r.jsxs)("div", {
                                    className: "flex flex-col gap-4",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex items-center justify-between",
                                        children: [(0, r.jsxs)("div", {
                                            children: [(0, r.jsx)("div", {
                                                className: "text-sm font-semibold text-foreground",
                                                children: "Tennis Rank"
                                            }), (0, r.jsx)("div", {
                                                className: "text-[11px] text-muted-foreground",
                                                children: u ? [m && "Player ".concat(m), p && "Diff ".concat(p)].filter(Boolean).join(" / ") : "Filter player rank and rank difference"
                                            })]
                                        }), (0, r.jsx)(D.z, {
                                            size: "sm",
                                            variant: "secondary",
                                            className: "h-7 px-2 rounded-lg text-xs",
                                            onClick: g,
                                            children: "Clear"
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "rounded-xl border border-input-border bg-input-bg/40 p-3",
                                        children: [(0, r.jsxs)("div", {
                                            className: "mb-2 flex items-center justify-between",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xs font-semibold text-foreground",
                                                children: "Player Rank"
                                            }), (0, r.jsxs)("div", {
                                                className: "flex items-center gap-2",
                                                children: [(0, r.jsx)("span", {
                                                    className: "text-[11px] text-muted-foreground",
                                                    children: m || "Any rank"
                                                }), (o.playerRankMin || o.playerRankMax) && (0, r.jsx)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-6 rounded-md px-2 text-[10px]",
                                                    onClick: b,
                                                    children: "Clear"
                                                })]
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "grid grid-cols-2 gap-2",
                                            children: [(0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "1",
                                                value: o.playerRankMin,
                                                onChange: e => f({
                                                    playerRankMin: w(e.target.value)
                                                }),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "500",
                                                value: o.playerRankMax,
                                                onChange: e => f({
                                                    playerRankMax: w(e.target.value)
                                                }),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        }), (0, r.jsx)(eA.i, {
                                            min: 1,
                                            max: 500,
                                            step: 1,
                                            minStepsBetweenThumbs: 10,
                                            value: k,
                                            debounceMs: 0,
                                            onValueChange: e => {
                                                let [t, s] = e;
                                                return f({
                                                    playerRankMin: String(t),
                                                    playerRankMax: String(s)
                                                })
                                            },
                                            hideThumbLabels: !0,
                                            className: "pb-2 pt-4"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex justify-between text-[10px] text-muted-foreground",
                                            children: [(0, r.jsx)("span", {
                                                children: "#1"
                                            }), (0, r.jsx)("span", {
                                                children: "#250"
                                            }), (0, r.jsx)("span", {
                                                children: "#500"
                                            })]
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "rounded-xl border border-input-border bg-input-bg/40 p-3",
                                        children: [(0, r.jsxs)("div", {
                                            className: "mb-2 flex items-center justify-between",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xs font-semibold text-foreground",
                                                children: "Rank Difference"
                                            }), (0, r.jsxs)("div", {
                                                className: "flex items-center gap-2",
                                                children: [(0, r.jsx)("span", {
                                                    className: "text-[11px] text-muted-foreground",
                                                    children: p || "Any difference"
                                                }), (o.rankDiffMin || o.rankDiffMax) && (0, r.jsx)(D.z, {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "secondary",
                                                    className: "h-6 rounded-md px-2 text-[10px]",
                                                    onClick: j,
                                                    children: "Clear"
                                                })]
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "grid grid-cols-2 gap-2",
                                            children: [(0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "0",
                                                value: o.rankDiffMin,
                                                onChange: e => f({
                                                    rankDiffMin: w(e.target.value)
                                                }),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            }), (0, r.jsx)(eZ.I, {
                                                inputMode: "numeric",
                                                placeholder: "500",
                                                value: o.rankDiffMax,
                                                onChange: e => f({
                                                    rankDiffMax: w(e.target.value)
                                                }),
                                                className: "h-10 rounded-lg bg-input-bg border border-input-border text-sm"
                                            })]
                                        }), (0, r.jsx)(eA.i, {
                                            min: 0,
                                            max: 500,
                                            step: 1,
                                            minStepsBetweenThumbs: 10,
                                            value: C,
                                            debounceMs: 0,
                                            onValueChange: e => {
                                                let [t, s] = e;
                                                return f({
                                                    rankDiffMin: String(t),
                                                    rankDiffMax: String(s)
                                                })
                                            },
                                            hideThumbLabels: !0,
                                            className: "pb-2 pt-4"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex justify-between text-[10px] text-muted-foreground",
                                            children: [(0, r.jsx)("span", {
                                                children: "0"
                                            }), (0, r.jsx)("span", {
                                                children: "250"
                                            }), (0, r.jsx)("span", {
                                                children: "500"
                                            })]
                                        }), (0, r.jsx)("p", {
                                            className: "mt-2 text-[11px] leading-relaxed text-muted-foreground",
                                            children: "Difference between player ranks; lower values mean a more evenly ranked matchup."
                                        })]
                                    })]
                                })
                            })]
                        })
                    })
                }),
                st = (0, a.memo)(function(e) {
                    let {
                        selectedRange: t,
                        setSelectedRange: s,
                        onFilterChange: l,
                        triggerClassName: i
                    } = e, [o, d] = (0, a.useState)(() => e4(t)), c = !!e4(o), u = (0, a.useMemo)(() => {
                        var e;
                        return null !== (e = e3(o)) && void 0 !== e ? e : [0, 100]
                    }, [o]), m = function(e) {
                        let t = e3(e);
                        return t && (0 !== t[0] || 100 !== t[1]) ? "".concat(t[0], "% - ").concat(t[1], "%") : "All win chances"
                    }(o);
                    (0, a.useEffect)(() => {
                        d(e4(t))
                    }, [t]);
                    let p = (0, a.useMemo)(() => eu()(e => {
                        s(e), null == l || l()
                    }, 300), [l, s]);
                    (0, a.useEffect)(() => () => {
                        p.cancel()
                    }, [p]);
                    let x = (0, a.useCallback)(e => {
                            p.cancel(), s(e), null == l || l()
                        }, [p, l, s]),
                        h = (0, a.useCallback)(() => {
                            d(""), x("")
                        }, [x]),
                        f = (0, a.useCallback)(e => {
                            let [t, s] = e;
                            if (null == t || null == s) return;
                            let r = e4("".concat(t, "-").concat(s));
                            d(r), p(r)
                        }, [p]);
                    return (0, r.jsxs)(M.J2, {
                        children: [(0, r.jsx)(M.xo, {
                            asChild: !0,
                            children: (0, r.jsxs)(D.z, {
                                variant: "secondary",
                                className: (0, n.Z)("h-11 rounded-xl border flex items-center justify-between !px-3.5", tj(c), i),
                                "aria-label": "Moneyline filter",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                    children: [c && (0, r.jsx)(tk, {
                                        onClear: h
                                    }), (0, r.jsx)(y.R_H, {
                                        className: (0, n.Z)("h-4 w-4 ml-1", tw(c))
                                    }), (0, r.jsx)("span", {
                                        className: tN(c),
                                        children: c ? "Moneyline ".concat(m) : "Moneyline"
                                    })]
                                }), (0, r.jsx)(Y.Z, {
                                    className: ty(c)
                                })]
                            })
                        }), (0, r.jsx)(M.yk, {
                            className: "w-[320px] rounded-xl border border-input bg-card-bg p-3 shadow-2xl",
                            align: "start",
                            children: (0, r.jsxs)("div", {
                                className: "flex flex-col gap-3",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-start justify-between gap-3",
                                    children: [(0, r.jsxs)("div", {
                                        className: "min-w-0 space-y-1",
                                        children: [(0, r.jsx)("div", {
                                            className: "text-sm font-semibold text-foreground",
                                            children: "Moneyline"
                                        }), (0, r.jsx)("p", {
                                            className: "text-[11px] leading-snug text-muted-foreground",
                                            children: "Filters by the player's team win probability from bookmaker moneyline odds."
                                        })]
                                    }), c && (0, r.jsx)(D.z, {
                                        type: "button",
                                        size: "sm",
                                        variant: "secondary",
                                        className: "h-7 shrink-0 rounded-lg px-2 text-xs",
                                        onClick: h,
                                        children: "Clear"
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "rounded-xl border border-input-border bg-input-bg/40 px-3 pb-3 pt-2",
                                    children: [(0, r.jsxs)("div", {
                                        className: "mb-3 flex items-center justify-between gap-3",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-xs font-semibold text-foreground",
                                            children: "Win Chance Range"
                                        }), (0, r.jsx)("span", {
                                            className: "shrink-0 rounded-md bg-highlight px-2 py-1 text-xs font-semibold text-foreground",
                                            children: m
                                        })]
                                    }), (0, r.jsx)(eA.i, {
                                        min: 0,
                                        max: 100,
                                        step: 1,
                                        minStepsBetweenThumbs: 0,
                                        value: u,
                                        debounceMs: 0,
                                        onValueChange: f,
                                        hideThumbLabels: !0,
                                        className: "pb-2 pt-3"
                                    }), (0, r.jsxs)("div", {
                                        className: "flex justify-between text-[10px] text-muted-foreground",
                                        children: [(0, r.jsx)("span", {
                                            children: "0%"
                                        }), (0, r.jsx)("span", {
                                            children: "50%"
                                        }), (0, r.jsx)("span", {
                                            children: "100%"
                                        })]
                                    })]
                                })]
                            })
                        })]
                    })
                }),
                ss = (0, a.memo)(function(e) {
                    let {
                        selectedTeams: t,
                        setSelectedTeams: s,
                        teamOptions: l,
                        availableTeams: i,
                        sport: o,
                        triggerClassName: d,
                        maxDisplay: c = 2
                    } = e, u = (0, a.useMemo)(() => l.map(e => e.value), [l]), m = t.length > 0, p = 0 === t.length ? "Teams" : "".concat(t.length, " ").concat(1 === t.length ? "Team" : "Teams"), x = (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-2 px-2",
                        children: [m && (0, r.jsx)(tk, {
                            onClear: () => s([])
                        }), (0, r.jsx)(b.sfm, {
                            size: 25,
                            className: (0, n.Z)("w-5 h-5", tw(m))
                        }), (0, r.jsx)("span", {
                            className: tN(m),
                            children: p
                        })]
                    }), h = m && i.length > 0 ? (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-1.5 overflow-hidden px-2",
                        children: [(0, r.jsx)(tk, {
                            onClear: () => s([])
                        }), (0, r.jsx)("div", {
                            className: "min-w-0 flex-1 overflow-hidden",
                            children: (0, r.jsx)(tH, {
                                selectedTeamKeys: t,
                                teams: i,
                                sport: o,
                                maxDisplay: c
                            })
                        })]
                    }) : x;
                    return (0, r.jsx)("div", {
                        children: (0, r.jsx)(_.N, {
                            options: l,
                            selectedValues: t,
                            allValues: u,
                            onValueChange: s,
                            enableOnlyAction: !0,
                            placeholder: "Teams",
                            variant: "secondary",
                            hideSelectAll: !0,
                            maxCount: 1,
                            showTriggerClear: !1,
                            className: (0, n.Z)("h-11 w-max min-w-[132px]", tj(m), d),
                            triggerActive: m,
                            emptyDisplayLabel: x,
                            customDisplayLabel: h
                        })
                    })
                });

            function sr(e) {
                return "any" === e ? {
                    label: "Modifier",
                    icon: (0, r.jsx)(v.ygk, {
                        className: "h-4 w-4 text-muted-foreground"
                    })
                } : "udfixed" === e ? {
                    label: "UD Fixed",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "underdog",
                        size: 16
                    })
                } : "dabblefixed" === e ? {
                    label: "Dabble Fixed",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "dabble",
                        size: 16
                    })
                } : "none" === e ? {
                    label: "PP Fixed",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "prizepicks",
                        size: 16
                    })
                } : "sleepermain" === e ? {
                    label: "Sleeper Main",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "sleeper",
                        size: 16
                    })
                } : "parlayplaymain" === e ? {
                    label: "ParlayPlay Main",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "parlayplay",
                        size: 16
                    })
                } : "betrfixed" === e ? {
                    label: "Betr Fixed",
                    icon: (0, r.jsx)(F.Z, {
                        appName: "betr",
                        size: 16
                    })
                } : "edge" === e ? {
                    label: "Betr Edge",
                    icon: (0, r.jsx)(F.Z, {
                        modifier: "edge",
                        size: 16
                    })
                } : "boost" === e ? {
                    label: "Betr Boost",
                    icon: (0, r.jsx)(F.Z, {
                        modifier: "boost",
                        size: 16
                    })
                } : {
                    label: e.charAt(0).toUpperCase() + e.slice(1),
                    icon: (0, r.jsx)(F.Z, {
                        modifier: e,
                        size: 16
                    })
                }
            }
            let sn = (0, a.memo)(function(e) {
                    let {
                        selectedModifier: t,
                        setSelectedModifier: s,
                        modifiers: l,
                        triggerClassName: i
                    } = e, o = (0, a.useMemo)(() => l.map(e => {
                        let {
                            label: t,
                            icon: s
                        } = sr(e);
                        return {
                            value: e,
                            label: t,
                            icon: s
                        }
                    }), [l]), {
                        label: d,
                        icon: c
                    } = sr(t), u = "any" !== t, m = (0, r.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-2 px-2",
                        children: [u && (0, r.jsx)(tk, {
                            onClear: () => s("any")
                        }), c && (0, r.jsx)("span", {
                            className: (0, n.Z)("shrink-0", tw(u)),
                            children: c
                        }), (0, r.jsx)("span", {
                            className: tN(u),
                            children: d
                        })]
                    });
                    return (0, r.jsx)(_.N, {
                        options: o,
                        selectedValues: [t],
                        allValues: l,
                        onValueChange: e => {
                            var t;
                            s(null !== (t = e[0]) && void 0 !== t ? t : "any")
                        },
                        placeholder: "Modifier",
                        variant: "secondary",
                        maxSelect: 1,
                        maxCount: 1,
                        hideSelectAll: !0,
                        showTriggerClear: !1,
                        emptyDisplayLabel: m,
                        customDisplayLabel: m,
                        triggerActive: u,
                        className: (0, n.Z)("h-11 w-max min-w-[128px]", tj(u), i)
                    })
                }),
                sa = (0, a.memo)(function(e) {
                    let {
                        date: t,
                        setDate: s,
                        setLocalDate: a,
                        triggerClassName: l
                    } = e, i = !!t;
                    return (0, r.jsx)("div", {
                        children: (0, r.jsxs)(M.J2, {
                            children: [(0, r.jsx)(M.xo, {
                                asChild: !0,
                                children: (0, r.jsxs)(D.z, {
                                    variant: "secondary",
                                    className: (0, en.cn)("h-11 rounded-xl border flex items-center justify-between !px-3.5", tj(i), l),
                                    "aria-label": "Game date filter",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                                        children: [i && (0, r.jsx)(tk, {
                                            onClear: () => {
                                                s(void 0), a("")
                                            }
                                        }), (0, r.jsx)(v.S08, {
                                            className: (0, n.Z)("w-4 h-4", tw(i))
                                        }), t ? (0, r.jsx)("span", {
                                            className: (0, en.cn)("truncate text-sm", tN(i)),
                                            children: o()(t).format("MMM D")
                                        }) : (0, r.jsx)("span", {
                                            className: "truncate text-sm text-muted-foreground",
                                            children: "Date"
                                        })]
                                    }), (0, r.jsx)(Y.Z, {
                                        className: ty(i)
                                    })]
                                })
                            }), (0, r.jsx)(M.yk, {
                                className: "w-auto p-0 bg-card-bg border border-input-border rounded-xl",
                                children: (0, r.jsx)(ep.f, {
                                    mode: "single",
                                    selected: t,
                                    onSelect: e => {
                                        s(e), a(e ? e.toISOString() : "")
                                    },
                                    initialFocus: !0
                                })
                            })]
                        })
                    })
                }),
                sl = (0, a.memo)(function(e) {
                    let {
                        children: t,
                        tableColumns: s,
                        props: l,
                        sport: i,
                        showPaginationSpace: o,
                        isLoading: d,
                        filtersLoading: c,
                        setSortSetting: u,
                        isFilterChangeRef: m,
                        isPageChangeRef: p,
                        fillHeight: x = !0,
                        maxHeight: h
                    } = e, f = (0, a.useRef)(null), {
                        scrollPosition: g
                    } = (0, eI.v)(), [b, v] = (0, P.J)(), {
                        userFilters: j
                    } = (0, eL.mN)();
                    (0, a.useRef)(i);
                    let w = j.sort,
                        N = (0, a.useCallback)(e => {
                            let t = e.replace(/^-/, ""),
                                s = w.findIndex(e => e.replace(/^-/, "") === t);
                            return s >= 0 ? s + 1 : null
                        }, [w]),
                        y = (0, a.useCallback)(e => {
                            let t = e.replace(/^-/, ""),
                                s = w.find(e => e.replace(/^-/, "") === t);
                            return s ? s.startsWith("-") ? "desc" : "asc" : null
                        }, [w]);
                    return (0, a.useEffect)(() => {
                        let e = f.current;
                        e && (e.scrollTop = g || 0)
                    }, []), (0, a.useEffect)(() => {
                        let e = f.current;
                        e && (m.current || p.current) && (e.scrollTop = 0, m.current = !1)
                    }), (0, r.jsxs)("div", {
                        ref: f,
                        id: "desktop-props-container",
                        className: (0, n.Z)("hidden overflow-auto overscroll-none rounded-xl border border-border md:block custom-scrollbar relative", x ? "h-full flex-1" : "min-h-0 [flex:0_1_auto]"),
                        style: !x && h ? {
                            maxHeight: h
                        } : void 0,
                        children: [(d || c) && l && l.length > 0 && (0, r.jsx)("div", {
                            className: " absolute inset-0 bg-black/20 flex items-center justify-center z-20 ",
                            children: (0, r.jsx)("div", {
                                className: "flex flex-col items-center gap-3",
                                children: (0, r.jsx)(eg.Z, {
                                    className: "h-6 w-6 animate-spin text-button"
                                })
                            })
                        }), (0, r.jsxs)("table", {
                            className: "w-full overflow-auto",
                            children: [(0, r.jsx)("thead", {
                                className: "bg-new-bg rounded-xl sticky top-0 z-10",
                                children: (0, r.jsx)(so, {
                                    tableColumns: s,
                                    sortSettings: w,
                                    setSortSetting: u,
                                    getSortPosition: N,
                                    getSortDirection: y
                                })
                            }), t]
                        }), o && (0, r.jsx)("div", {
                            "aria-hidden": !0,
                            className: "h-14"
                        })]
                    })
                }),
                si = (0, a.memo)(function(e) {
                    let {
                        props: t,
                        sport: s,
                        appsOrder: n,
                        isPublicPreview: a = !1,
                        publicFavoriteLabel: l,
                        onPublicFavorite: i
                    } = e;
                    return (0, r.jsx)(r.Fragment, {
                        children: t.map((e, t) => (0, r.jsx)(sk, {
                            prop: e,
                            index: t,
                            appsOrder: n,
                            sport: e.sport,
                            all: "all" === s.toLowerCase(),
                            isPublicPreview: a,
                            publicFavoriteLabel: l,
                            onPublicFavorite: i
                        }, t))
                    })
                }),
                so = (0, a.memo)(function(e) {
                    let {
                        tableColumns: t,
                        sortSettings: s,
                        setSortSetting: a,
                        getSortPosition: l,
                        getSortDirection: i
                    } = e, o = (e, t) => {
                        t.preventDefault(), t.stopPropagation();
                        let s = e.replace(/^-/, ""),
                            r = i(s);
                        r && a("desc" === r ? "-".concat(s) : s)
                    };
                    return (0, r.jsx)("tr", {
                        children: t.filter(e => !e.hideColumn).map((e, t) => {
                            let d = "Line" === e.name || "Apps" === e.name,
                                c = "Line" === e.name ? "pl-4 pr-2" : "Apps" === e.name ? "px-4" : "px-1.5";
                            return (0, r.jsx)("th", {
                                className: (0, n.Z)("text-sm font-medium text-nowrap min-w-max text-muted-foreground max-w-max", c, !e.sortId && "py-3.5", d ? "text-left" : "text-center"),
                                children: e.description ? "chances" === e.sortId ? (0, r.jsxs)(k.h_, {
                                    children: [(0, r.jsx)(k.$F, {
                                        className: "focus:!ring-0 !ring-0 !border-none !outline-none",
                                        children: (0, r.jsxs)("div", {
                                            className: (0, n.Z)("group/sort-trigger relative flex items-center gap-2 min-w-max mx-auto", {
                                                "hover:bg-highlight px-2 py-0.5 rounded-md": e.sortId,
                                                "bg-highlight hover:brightness-95": s.some(e => e.includes("_over_ip") || e.includes("_under_ip"))
                                            }),
                                            children: [e.name, (0, r.jsx)(eM.Z, {
                                                width: 14
                                            }), (null !== l("-consensus_over_ip") || null !== l("-consensus_under_ip")) && (0, r.jsx)(tK, {
                                                position: null !== l("-consensus_over_ip") ? l("-consensus_over_ip") : l("-consensus_under_ip"),
                                                onClear: e => o(null !== l("-consensus_over_ip") ? "consensus_over_ip" : "consensus_under_ip", e)
                                            })]
                                        })
                                    }), (0, r.jsxs)(k.AW, {
                                        className: "bg-new-bg",
                                        children: [(0, r.jsx)(k.Xi, {
                                            disabled: !0,
                                            className: "text-sm font-semibold max-w-60 text-slate-200",
                                            children: "Sort By (Choose One)"
                                        }), (0, r.jsxs)(k.Xi, {
                                            onClick: () => {
                                                a("-consensus_over_ip")
                                            },
                                            className: (0, n.Z)("flex items-center gap-2", null !== l("-consensus_over_ip") && "bg-highlight"),
                                            children: [(0, r.jsx)("div", {
                                                className: (0, n.Z)("w-4 h-4 rounded-full border flex items-center justify-center", null !== l("-consensus_over_ip") ? "border-blue-500" : "border-gray-500"),
                                                children: null !== l("-consensus_over_ip") && (0, r.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-blue-500"
                                                })
                                            }), (0, r.jsx)("span", {
                                                children: "% Chance Of Over Hitting"
                                            }), null !== l("-consensus_over_ip") && (0, r.jsx)(tG, {
                                                position: l("-consensus_over_ip")
                                            })]
                                        }), (0, r.jsxs)(k.Xi, {
                                            onClick: () => {
                                                a("-consensus_under_ip")
                                            },
                                            className: (0, n.Z)("flex items-center gap-2", null !== l("-consensus_under_ip") && "bg-highlight"),
                                            children: [(0, r.jsx)("div", {
                                                className: (0, n.Z)("w-4 h-4 rounded-full border flex items-center justify-center", null !== l("-consensus_under_ip") ? "border-blue-500" : "border-gray-500"),
                                                children: null !== l("-consensus_under_ip") && (0, r.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-blue-500"
                                                })
                                            }), (0, r.jsx)("span", {
                                                children: "% Chance Of Under Hitting"
                                            }), null !== l("-consensus_under_ip") && (0, r.jsx)(tG, {
                                                position: l("-consensus_under_ip")
                                            })]
                                        }), (0, r.jsx)(k.Xi, {
                                            disabled: !0,
                                            className: "text-xs max-w-64 text-slate-300",
                                            children: e.description
                                        })]
                                    })]
                                }) : "differenceLast10" === e.sortId ? (() => {
                                    var t;
                                    let s = null !== l("differencePercent") ? "differencePercent" : "differenceLast10",
                                        d = null !== (t = i(s)) && void 0 !== t ? t : "desc",
                                        c = l(s);
                                    return (0, r.jsxs)(k.h_, {
                                        children: [(0, r.jsx)(k.$F, {
                                            className: "focus:!ring-0 !ring-0 !border-none !outline-none",
                                            children: (0, r.jsxs)("div", {
                                                className: (0, n.Z)("group/sort-trigger relative flex items-center gap-2 min-w-max mx-auto", {
                                                    "hover:bg-highlight px-2 py-0.5 rounded-md": e.sortId,
                                                    "bg-highlight hover:brightness-95": null !== c
                                                }),
                                                children: ["differencePercent" === s && null !== c ? "Diff %" : "Diff", "asc" === d ? (0, r.jsx)(eC.Z, {
                                                    width: 14
                                                }) : (0, r.jsx)(eM.Z, {
                                                    width: 14
                                                }), null !== c && (0, r.jsx)(tK, {
                                                    position: c,
                                                    onClear: e => o(s, e)
                                                })]
                                            })
                                        }), (0, r.jsx)(tq, {
                                            activeMetric: s,
                                            activeDirection: d,
                                            hasActiveSort: null !== c,
                                            setSortSetting: a
                                        })]
                                    })
                                })() : (0, r.jsx)("div", {
                                    className: (0, n.Z)("flex items-center  gap-2", "Line" === e.name || "Apps" === e.name ? "" : "justify-evenly"),
                                    children: (0, r.jsx)(eF.pn, {
                                        delayDuration: 100,
                                        children: (0, r.jsxs)(eF.u, {
                                            children: [(0, r.jsx)(eF.aJ, {
                                                onClick: () => {
                                                    if (!e.sortId) return;
                                                    let t = l(e.sortId);
                                                    i(e.sortId), null !== t ? a(e.sortId) : a("-".concat(e.sortId))
                                                },
                                                children: (0, r.jsxs)("div", {
                                                    className: (0, n.Z)("group/sort-trigger relative flex items-center gap-1 min-w-max mx-auto", {
                                                        "hover:bg-highlight py-0.5 px-2 rounded-md": e.sortId,
                                                        "bg-highlight hover:brightness-95": e.sortId && null !== l(e.sortId)
                                                    }),
                                                    children: [e.name, e.sortId && (null !== l(e.sortId) ? "desc" === i(e.sortId) ? (0, r.jsx)(eM.Z, {
                                                        width: 14
                                                    }) : (0, r.jsx)(eC.Z, {
                                                        width: 14
                                                    }) : (0, r.jsx)(eM.Z, {
                                                        width: 14
                                                    })), e.sortId && null !== l(e.sortId) && (0, r.jsx)(tK, {
                                                        position: l(e.sortId),
                                                        onClear: t => {
                                                            e.sortId && o(e.sortId, t)
                                                        }
                                                    })]
                                                })
                                            }), (0, r.jsx)(eF._v, {
                                                className: "text-wrap",
                                                children: e.description
                                            })]
                                        })
                                    })
                                }) : (0, r.jsx)("div", {
                                    className: "flex w-full items-center gap-2 min-w-max",
                                    children: e.name
                                })
                            }, e.name)
                        })
                    })
                }),
                sd = (0, a.memo)(function() {
                    return (0, r.jsx)("tbody", {
                        children: Array.from({
                            length: 26
                        }).map((e, t) => (0, r.jsx)("tr", {
                            className: "animate-pulse",
                            children: (0, r.jsx)("td", {
                                colSpan: 15,
                                className: "px-4 py-4",
                                children: (0, r.jsx)("div", {
                                    className: "h-4 bg-input-border rounded-full w-full"
                                })
                            })
                        }, t))
                    })
                }),
                sc = (0, a.memo)(function(e) {
                    let {
                        count: t = 20,
                        pulse: s = !0
                    } = e;
                    return (0, r.jsx)(r.Fragment, {
                        children: Array.from({
                            length: t
                        }).map((e, t) => (0, r.jsxs)("div", {
                            className: (0, n.Z)("rounded-xl flex flex-col gap-2 border border-input p-4 h-48", s && "animate-pulse"),
                            children: [(0, r.jsx)("div", {
                                className: "h-4 w-1/5 bg-input-bg rounded-full"
                            }), (0, r.jsx)("div", {
                                className: "h-4 w-1/3 bg-input-bg rounded-full"
                            }), (0, r.jsx)("div", {
                                className: "h-4 w-2/5 bg-input-bg rounded-full"
                            }), (0, r.jsxs)("div", {
                                className: "flex gap-2 w-full",
                                children: [(0, r.jsx)("div", {
                                    className: "min-w-12 flex-shrink-0 bg-input-bg aspect-square rounded-md"
                                }), (0, r.jsx)("div", {
                                    className: "min-w-12 flex-shrink-0 bg-input-bg aspect-square rounded-md"
                                }), (0, r.jsx)("div", {
                                    className: "min-w-12 flex-shrink-0 bg-input-bg aspect-square rounded-md"
                                }), (0, r.jsx)("div", {
                                    className: "min-w-12 flex-shrink-0 bg-input-bg aspect-square rounded-md"
                                })]
                            })]
                        }, t))
                    })
                }),
                su = (0, a.memo)(function(e) {
                    let {
                        currentPage: t,
                        totalPageCount: s,
                        setSportFilter: l,
                        sport: i,
                        perPage: o,
                        setPerPage: d,
                        isFilterChangeRef: c
                    } = e, u = Math.max(s || 1, 1), m = Math.min(Math.max(t || 1, 1), u), p = m <= 1, x = m >= u, [h, f] = (0, a.useState)(!1), [g, b] = (0, a.useState)(0), v = (0, a.useRef)(null), j = (0, a.useRef)(null), w = (0, a.useCallback)(e => {
                        let s = Math.min(Math.max(e, 1), u);
                        s !== t && (l(i, "page", s), c.current = !0)
                    }, [t, c, u, l, i]);
                    return (0, a.useEffect)(() => {
                        f(!1)
                    }, [m, u, o, i]), (0, a.useEffect)(() => {
                        let e = document.getElementById("desktop-props-container");
                        if (!e) return;
                        let t = () => {
                            b(Math.max(0, e.offsetHeight - e.clientHeight - 2))
                        };
                        t();
                        let s = new ResizeObserver(t);
                        s.observe(e);
                        let r = e.querySelector("table");
                        return r && s.observe(r), () => s.disconnect()
                    }, []), (0, a.useEffect)(() => {
                        let e = document.getElementById("desktop-props-container");
                        if (!e) return;
                        let t = e.scrollTop,
                            s = () => {
                                let t = Math.max(e.scrollHeight - e.clientHeight, 0);
                                return t > 0 && t - e.scrollTop < 96
                            };
                        f(!1);
                        let r = () => {
                            null === j.current && (j.current = window.requestAnimationFrame(() => {
                                j.current = null;
                                let r = e.scrollTop,
                                    n = r - t;
                                s() || n < -3 ? f(!1) : n > 3 && f(!0), t = r, null !== v.current && window.clearTimeout(v.current), v.current = window.setTimeout(() => {
                                    f(!1)
                                }, 500)
                            }))
                        };
                        return e.addEventListener("scroll", r, {
                            passive: !0
                        }), () => {
                            e.removeEventListener("scroll", r), null !== j.current && window.cancelAnimationFrame(j.current), null !== v.current && window.clearTimeout(v.current)
                        }
                    }, []), (0, r.jsx)("div", {
                        "aria-hidden": h,
                        className: (0, n.Z)("pointer-events-none absolute inset-x-0 z-30 hidden justify-center px-3 transition-all duration-200 ease-out md:flex", h ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"),
                        style: {
                            bottom: 12 + g
                        },
                        children: (0, r.jsxs)("div", {
                            className: (0, n.Z)("flex max-w-full items-center gap-1 rounded-xl border border-input-border bg-new-bg p-1 text-primary shadow-[0_18px_44px_rgba(0,0,0,0.38)]", h ? "pointer-events-none" : "pointer-events-auto"),
                            children: [(0, r.jsx)(sm, {
                                ariaLabel: "Previous page",
                                disabled: p,
                                onClick: () => w(m - 1),
                                children: (0, r.jsx)(ee.Z, {
                                    className: "h-4 w-4"
                                })
                            }), (0, r.jsxs)("div", {
                                className: "flex h-8 min-w-[96px] items-center justify-center gap-1 rounded-lg border border-input bg-input-bg px-2.5 text-xs font-medium tabular-nums",
                                children: [(0, r.jsx)("span", {
                                    className: "text-muted-foreground",
                                    children: "Page"
                                }), (0, r.jsx)("span", {
                                    children: m
                                }), (0, r.jsx)("span", {
                                    className: "text-muted-foreground",
                                    children: "/"
                                }), (0, r.jsx)("span", {
                                    className: "text-muted-foreground",
                                    children: u
                                })]
                            }), (0, r.jsx)(sm, {
                                ariaLabel: "Next page",
                                disabled: x,
                                onClick: () => w(m + 1),
                                children: (0, r.jsx)(et.Z, {
                                    className: "h-4 w-4"
                                })
                            }), (0, r.jsx)("div", {
                                className: "mx-0.5 h-6 w-px bg-input-border/80"
                            }), (0, r.jsx)(sp, {
                                perPage: o,
                                setPerPage: d,
                                setSportFilter: l,
                                sport: i
                            })]
                        })
                    })
                }),
                sm = (0, a.memo)(function(e) {
                    let {
                        children: t,
                        disabled: s = !1,
                        ariaLabel: a,
                        onClick: l
                    } = e;
                    return (0, r.jsx)("button", {
                        type: "button",
                        "aria-label": a,
                        disabled: s,
                        onClick: l,
                        className: (0, n.Z)("grid h-8 w-8 place-items-center rounded-lg border border-input bg-input-bg text-muted-foreground transition-colors hover:bg-input-border hover:text-primary", s && "cursor-not-allowed opacity-35 hover:bg-input-bg hover:text-muted-foreground"),
                        children: t
                    })
                }),
                sp = (0, a.memo)(function(e) {
                    let {
                        perPage: t,
                        setPerPage: s,
                        setSportFilter: n,
                        sport: a
                    } = e;
                    return (0, r.jsx)("div", {
                        children: (0, r.jsxs)(eR.Ph, {
                            value: t.toString(),
                            onValueChange: e => {
                                s(parseInt(e)), n(a, "page", 1)
                            },
                            children: [(0, r.jsx)(eR.i4, {
                                className: "h-8 min-h-8 min-w-[112px] rounded-lg border border-input bg-input-bg px-2.5 py-1.5 text-xs text-primary shadow-none hover:bg-input-border",
                                children: (0, r.jsxs)("div", {
                                    className: "flex min-w-0 items-center gap-1.5",
                                    children: [(0, r.jsx)(es.Z, {
                                        className: "h-3.5 w-3.5 shrink-0 text-button"
                                    }), (0, r.jsx)("span", {
                                        className: "text-muted-foreground",
                                        children: "Rows"
                                    }), (0, r.jsx)(eR.ki, {})]
                                })
                            }), (0, r.jsxs)(eR.Bw, {
                                className: "border-input-border bg-card-bg shadow-2xl",
                                children: [(0, r.jsx)(eR.Ql, {
                                    value: "20",
                                    children: "20 rows"
                                }), (0, r.jsx)(eR.Ql, {
                                    value: "50",
                                    children: "50 rows"
                                }), (0, r.jsx)(eR.Ql, {
                                    value: "100",
                                    children: "100 rows"
                                })]
                            })]
                        })
                    })
                }),
                sx = (0, a.memo)(function(e) {
                    let {
                        children: t,
                        props: s,
                        isLoading: n,
                        filtersLoading: l,
                        loadMoreRef: i,
                        isInfiniteValidating: o,
                        isFilterChangeRef: d
                    } = e, c = (0, a.useRef)(null), {
                        isMobile: u
                    } = (0, f.Ap)(), {
                        scrollPosition: m
                    } = (0, eI.v)();
                    return (0, a.useEffect)(() => {
                        let e = c.current;
                        e && requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                e.scrollTop = m || 0
                            })
                        })
                    }, []), (0, a.useEffect)(() => {
                        let e = c.current;
                        e && d.current && (e.scrollTop = 0, d.current = !1)
                    }), (0, r.jsx)(r.Fragment, {
                        children: (0, r.jsxs)("div", {
                            className: "relative w-full h-full overflow-hidden",
                            children: [(n || l) && s && s.length > 0 && (0, r.jsx)("div", {
                                className: " absolute inset-0 bg-black/40 flex items-center justify-center z-20 ",
                                children: (0, r.jsx)("div", {
                                    className: "flex flex-col items-center gap-3",
                                    children: (0, r.jsx)(eg.Z, {
                                        className: "h-6 w-6 animate-spin text-button"
                                    })
                                })
                            }), (0, r.jsxs)("div", {
                                ref: c,
                                className: "md:hidden flex flex-col gap-2 overflow-y-auto w-full custom-scrollbar pb-2 h-full",
                                id: "mobile-props-list",
                                children: [t, o && u && s.length > 0 && (0, r.jsx)("div", {
                                    className: "flex justify-center py-2",
                                    children: (0, r.jsx)(eg.Z, {
                                        className: "h-6 w-6 animate-spin text-blue-500"
                                    })
                                }), (0, r.jsx)("div", {
                                    ref: i,
                                    className: "h-4"
                                })]
                            })]
                        })
                    })
                }),
                sh = (0, a.memo)(function(e) {
                    let {
                        props: t,
                        isEndReached: s,
                        isPublicPreview: a = !1,
                        publicFavoriteLabel: l,
                        onPublicFavorite: i,
                        footer: o
                    } = e, {
                        sport: d
                    } = (0, Z.w)(), [c, u] = (0, P.J)();
                    return (0, r.jsxs)("div", {
                        className: (0, n.Z)("pb-2 md:pb-0 space-y-2", (s || a) && "pb-20"),
                        children: [t.map((e, t) => (0, r.jsx)(sf, {
                            appsOrder: c,
                            prop: e,
                            index: t,
                            sport: e.sport,
                            all: "all" === d.toLowerCase(),
                            isPublicPreview: a,
                            publicFavoriteLabel: l,
                            onPublicFavorite: i
                        }, "".concat(e.groupKey, "-").concat(t))), o]
                    })
                }),
                sf = (0, a.memo)(function(e) {
                    var t, s, l, i, c;
                    let {
                        prop: u,
                        sport: m = u.sport,
                        all: p,
                        isPublicPreview: x,
                        publicFavoriteLabel: h,
                        onPublicFavorite: f,
                        source: g = "props",
                        showTrendingCount: b = !1,
                        valuePick: v
                    } = e, {
                        setScrollPosition: j,
                        setTrendingScrollPosition: w,
                        setDiscrepanciesScrollPosition: N
                    } = (0, eI.v)(), y = function(e, t) {
                        if ("soccer" !== t) return e;
                        let s = e.trim().split(/\s+/);
                        return s.length > 3 ? "".concat(s[0], " ").concat(s[s.length - 1]) : e
                    }(u.player_name, m), [k] = (0, P.J)(), {
                        addFavorite: C,
                        removeFavorite: _,
                        favoritesLoading: S,
                        favoriteIdToFavorite: R
                    } = (0, d.r)(), [Z, A] = (0, a.useState)(!1), {
                        line: L,
                        stat: D,
                        averageLast10: O,
                        differenceLast10: z,
                        differencePercent: I,
                        hitRateLast5: T,
                        hitRateLast10: E,
                        hitRateLast15: U,
                        hitRateH2H: V,
                        h2hHits: B,
                        h2hGames: H,
                        streak: W,
                        hrSeason: G
                    } = u, J = "discrepancies" === g ? u : null, q = null == R ? void 0 : R[u.groupKey], K = "popular" === g ? "popular" : "discrepancies" === g ? "discrepancies" : "positive-ev" === g ? "positive-ev" : p ? "all" : "props", X = "/players/".concat(m, "/").concat(u.player_id, "?from=").concat(K, "&prop=").concat(encodeURIComponent(u.groupKey)), $ = "popular" === g && u.max_favorite_selection ? u.max_favorite_selection.charAt(0).toUpperCase() + u.max_favorite_selection.slice(1) : null, Q = J ? D : v ? "".concat("over" === v.direction ? "Over" : "Under", " ").concat(v.line, " ").concat(D) : $ ? "".concat($, " ").concat(L, " ").concat(D) : "O/U ".concat(L, " ").concat(D), Y = v ? Math.round(100 * Math.abs(v.line - v.neighbor.line)) / 100 : 0, ee = null == v ? void 0 : null === (t = v.neighbor.outcomes) || void 0 === t ? void 0 : t[v.direction], et = b && u.max_favorite_count > 0;
                    return u.game_string ? (0, r.jsxs)("div", {
                        className: (0, n.Z)("relative rounded-xl border flex flex-col text-primary bg-new-bg transition-all overflow-hidden flex-shrink-0", q ? "border-blue-400" : "border-input hover:border-slate-600"),
                        children: [(0, r.jsx)(ey.default, {
                            href: X,
                            onClick: () => {
                                let e = document.getElementById("popular" === g ? "trending-list-container" : "discrepancies" === g ? "discrepancies-list-container" : "mobile-props-list");
                                if (e) {
                                    let t = e.scrollTop;
                                    "popular" === g ? w(t) : "discrepancies" === g ? N(t) : j(t)
                                }
                            },
                            onContextMenu: e => e.preventDefault(),
                            onDragStart: e => e.preventDefault(),
                            draggable: !1,
                            prefetch: !1,
                            className: "absolute inset-0 z-0 select-none [-webkit-touch-callout:none] [-webkit-user-drag:none]",
                            "aria-label": "View ".concat(u.player_name, " details")
                        }), (0, r.jsx)("div", {
                            className: "pointer-events-none absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-gray-800 to-new-bg z-10"
                        }), (0, r.jsxs)("div", {
                            className: "relative z-20 flex flex-col pointer-events-none",
                            children: [(0, r.jsxs)("div", {
                                className: "flex items-start justify-between gap-2 px-2.5 pt-2.5 pb-0.5",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex min-w-0 items-start flex-col",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex min-w-0 items-center gap-3",
                                        children: [(0, r.jsxs)("div", {
                                            className: "relative pointer-events-auto",
                                            children: [(0, r.jsx)(eT.A, {
                                                playerId: u.player_id,
                                                playerName: u.player_name,
                                                imageUrl: u.player_image,
                                                size: 44,
                                                className: "border-2 border-slate-600/50",
                                                sport: m,
                                                priority: !0
                                            }), (0, r.jsxs)(M.J2, {
                                                open: Z,
                                                onOpenChange: A,
                                                children: [(0, r.jsx)(M.xo, {
                                                    className: (0, n.Z)("absolute -bottom-1.5 -right-1.5 transition-all ease-in animate rounded-full border bg-gradient-to-b from-highlight to-highlight/40 w-7 h-7 z-30 grid place-items-center", q ? "border-blue-400" : "border-input"),
                                                    children: (0, r.jsx)(eb.Z, {
                                                        className: (0, n.Z)("w-3.5 h-3.5", q ? "text-blue-400 fill-blue-400" : "text-muted-foreground")
                                                    })
                                                }), (0, r.jsx)(M.yk, {
                                                    className: "w-max bg-input-bg border-2 border-white/10 rounded-xl shadow-2xl p-3",
                                                    children: (0, r.jsx)("div", {
                                                        className: "flex flex-col gap-2",
                                                        children: x ? (0, r.jsx)("button", {
                                                            onClick: () => {
                                                                null == f || f(), A(!1)
                                                            },
                                                            className: "blue-button grid place-items-center rounded-lg py-1.5 px-4 text-sm font-semibold transition-all hover:scale-[1.02]",
                                                            children: null != h ? h : "Unlock"
                                                        }) : S ? (0, r.jsx)("div", {
                                                            className: "px-4 py-2 flex justify-center",
                                                            children: (0, r.jsx)(eg.Z, {
                                                                className: "w-6 h-6 animate-spin text-blue-500"
                                                            })
                                                        }) : q ? (0, r.jsxs)(r.Fragment, {
                                                            children: [(0, r.jsx)("div", {
                                                                className: "text-center",
                                                                children: (0, r.jsx)("p", {
                                                                    className: "text-xs text-muted-foreground",
                                                                    children: "Manage Favorite"
                                                                })
                                                            }), (0, r.jsx)("button", {
                                                                onClick: async () => {
                                                                    await _(u.groupKey), A(!1)
                                                                },
                                                                className: "bg-gradient-to-t from-red-600/90 to-red-500/90 hover:from-red-600 hover:to-red-500 rounded-lg py-1.5 px-4 border border-red-400/30 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-red-500/20",
                                                                children: "Remove"
                                                            })]
                                                        }) : (0, r.jsxs)(r.Fragment, {
                                                            children: [(0, r.jsx)("div", {
                                                                className: "text-center",
                                                                children: (0, r.jsx)("p", {
                                                                    className: "text-xs text-muted-foreground",
                                                                    children: "Add to Pick Builder"
                                                                })
                                                            }), (0, r.jsxs)("div", {
                                                                className: "flex gap-2 flex-col",
                                                                children: [(0, r.jsx)("button", {
                                                                    onClick: async () => {
                                                                        await C(u, "over"), A(!1)
                                                                    },
                                                                    className: "over-button grid place-items-center shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all !py-1 !px-4 !text-sm gap-1.5",
                                                                    children: (0, r.jsxs)("div", {
                                                                        className: "flex gap-2 items-center",
                                                                        children: [(0, r.jsx)(ev.Z, {
                                                                            className: "w-3.5 h-3.5"
                                                                        }), "Over"]
                                                                    })
                                                                }), (0, r.jsx)("button", {
                                                                    onClick: async () => {
                                                                        await C(u, "under"), A(!1)
                                                                    },
                                                                    className: "under-button shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all !py-1 !px-4 !text-sm grid place-items-center gap-1.5",
                                                                    children: (0, r.jsxs)("div", {
                                                                        className: "flex gap-2 items-center",
                                                                        children: [(0, r.jsx)(ej.Z, {
                                                                            className: "w-3.5 h-3.5"
                                                                        }), "Under"]
                                                                    })
                                                                })]
                                                            })]
                                                        })
                                                    })
                                                })]
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex min-w-0 flex-col flex-grow",
                                            children: [(0, r.jsxs)("h1", {
                                                className: "flex min-w-0 items-center gap-1.5 text-xs font-semibold",
                                                children: [(0, r.jsxs)("span", {
                                                    className: "min-w-0 truncate",
                                                    title: u.player_name,
                                                    children: [y, tv(u.team.rank), u.player_position && " (".concat((null === (i = e_.ZP[m]) || void 0 === i ? void 0 : null === (l = i.positionMap) || void 0 === l ? void 0 : l[null === (s = u.player_position) || void 0 === s ? void 0 : s.toLowerCase()]) || (null === (c = u.player_position) || void 0 === c ? void 0 : c.toUpperCase()), ")")]
                                                }), (0, r.jsx)("span", {
                                                    className: "inline-flex shrink-0",
                                                    children: (0, r.jsx)(eS.C, {
                                                        sport: m
                                                    })
                                                })]
                                            }), (0, r.jsx)("h2", {
                                                className: "text-gray-300 inline-flex items-center gap-1",
                                                children: (0, r.jsx)("p", {
                                                    className: "text-gray-300 w-max text-xs text-nowrap",
                                                    children: Q
                                                })
                                            }), (0, r.jsx)("div", {
                                                className: "mt-0.5 flex min-w-0 items-center gap-1 text-[11px] font-normal leading-none text-muted-foreground",
                                                children: u.is_live ? (0, r.jsxs)(r.Fragment, {
                                                    children: [(0, r.jsx)("span", {
                                                        className: "min-w-0 truncate",
                                                        children: tL(u, m)
                                                    }), (0, r.jsx)("span", {
                                                        className: "shrink-0 text-slate-500",
                                                        children: "•"
                                                    }), (0, r.jsx)(t_, {
                                                        compact: !0,
                                                        className: "ml-0"
                                                    })]
                                                }) : (0, r.jsxs)("span", {
                                                    className: "min-w-0 truncate",
                                                    children: [tL(u, m), u.start_date && (0, r.jsxs)(r.Fragment, {
                                                        children: [(0, r.jsx)("span", {
                                                            className: "text-slate-500",
                                                            children: " • "
                                                        }), o()(u.start_date).format("ddd @ h:mmA")]
                                                    })]
                                                })
                                            })]
                                        })]
                                    }), (et || tD(u, m, p)) && (0, r.jsxs)(tI, {
                                        children: [et && (0, r.jsxs)("span", {
                                            className: "inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-blue-400/30 bg-gradient-to-t from-blue-600 to-blue-500 px-1.5 text-[10px] font-semibold leading-none text-white",
                                            title: "".concat(u.max_favorite_count, " users saved this pick"),
                                            children: [(0, r.jsx)(ew.Z, {
                                                className: "h-2.5 w-2.5 shrink-0"
                                            }), (0, r.jsx)("span", {
                                                className: "tabular-nums",
                                                children: u.max_favorite_count
                                            }), "Saves"]
                                        }), "tennis" === m ? (0, r.jsx)(tz, {
                                            prop: u
                                        }) : (p || eU.includes(m)) && (0, r.jsx)(tE, {
                                            prop: u,
                                            sport: m
                                        }), (0, r.jsx)(tT, {
                                            prop: u,
                                            sport: m
                                        })]
                                    })]
                                }), J ? (0, r.jsx)("div", {
                                    className: "flex shrink-0 flex-col items-end",
                                    children: (0, r.jsxs)("div", {
                                        className: "inline-flex items-center gap-1.5 rounded-lg border border-input bg-highlight/60 px-2.5 py-1.5 shadow-sm",
                                        children: [(0, r.jsx)(eN.Z, {
                                            className: "w-4 h-4 text-button"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-0.5 leading-none",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xs leading-none text-primary",
                                                children: J.difference
                                            }), (0, r.jsxs)("span", {
                                                className: "text-[9px] font-medium leading-none text-muted-foreground",
                                                children: ["Diff ", J.diffPercent, "%"]
                                            })]
                                        })]
                                    })
                                }) : v ? (0, r.jsx)("div", {
                                    className: "flex shrink-0 flex-col items-end",
                                    children: (0, r.jsxs)("div", {
                                        className: "inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1.5 shadow-sm",
                                        children: [(0, r.jsx)(eN.Z, {
                                            className: "w-4 h-4 text-emerald-400"
                                        }), (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-0.5 leading-none",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xs leading-none tabular-nums text-emerald-300",
                                                children: Y
                                            }), (0, r.jsx)("span", {
                                                className: "text-[9px] font-medium leading-none text-muted-foreground",
                                                children: "Line diff"
                                            })]
                                        })]
                                    })
                                }) : (u.consensus_over_ip > 0 || u.consensus_under_ip > 0) && (0, r.jsx)("div", {
                                    className: "-mt-1 -mr-1 flex shrink-0 flex-col gap-0.5 items-center",
                                    children: (0, r.jsx)(ez.lW, {
                                        consensus: u.consensus
                                    })
                                })]
                            }), (0, r.jsxs)("div", {
                                className: (0, n.Z)("flex items-center gap-0.5 overflow-x-auto custom-scrollbar", et || tD(u, m, p) ? "mt-0" : "mt-2"),
                                children: [(0, r.jsx)(sw, {
                                    stat: "L5",
                                    value: T,
                                    threshold: 50,
                                    showPercent: !0
                                }), (0, r.jsx)(sw, {
                                    stat: "L10",
                                    value: E,
                                    threshold: 50,
                                    showPercent: !0
                                }), (0, r.jsx)(sw, {
                                    stat: "L15",
                                    value: U,
                                    threshold: 50,
                                    showPercent: !0
                                }), (0, r.jsx)(sw, {
                                    stat: "H2H",
                                    value: V,
                                    threshold: 50,
                                    showPercent: !0,
                                    subValue: tg({
                                        h2hHits: B,
                                        h2hGames: H
                                    })
                                }), (0, r.jsx)(sw, {
                                    stat: "STRK",
                                    value: W,
                                    threshold: 3
                                }), (0, r.jsx)(sw, {
                                    stat: "AVG",
                                    value: O,
                                    threshold: J ? J.minLine : v ? v.line : L
                                }), (0, r.jsx)(sw, {
                                    stat: "Diff",
                                    value: z,
                                    threshold: 0,
                                    subValue: tf(I)
                                }), (p || eU.includes(m) || "cod" === m || "soccer" === m) && (0, r.jsx)(sw, {
                                    stat: "SZN",
                                    value: G,
                                    threshold: 50,
                                    showPercent: !0
                                })]
                            }), J ? (0, r.jsx)("div", {
                                className: "px-2 py-2 pointer-events-auto",
                                children: (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-2",
                                    children: [(0, r.jsx)("div", {
                                        className: "rounded-lg border border-input bg-background/40 px-3 py-2 overflow-hidden",
                                        children: (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xxs text-muted-foreground",
                                                children: "Min line"
                                            }), (0, r.jsxs)("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [(0, r.jsx)("span", {
                                                    className: "text-xs text-primary",
                                                    children: J.minLine
                                                }), (0, r.jsx)(eD.E, {
                                                    apps: J.apps[0].apps,
                                                    appsOrder: k,
                                                    count: 2,
                                                    size: 16,
                                                    outcomesClassName: "text-xxxs"
                                                })]
                                            })]
                                        })
                                    }), (0, r.jsx)("div", {
                                        className: "rounded-lg border border-input bg-background/40 px-3 py-2 overflow-hidden",
                                        children: (0, r.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(0, r.jsx)("span", {
                                                className: "text-xxs text-muted-foreground",
                                                children: "Max line"
                                            }), (0, r.jsxs)("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [(0, r.jsx)("span", {
                                                    className: "text-xs text-primary",
                                                    children: J.maxLine
                                                }), (0, r.jsx)(eD.E, {
                                                    apps: J.apps[J.apps.length - 1].apps,
                                                    appsOrder: k,
                                                    count: 2,
                                                    size: 16,
                                                    outcomesClassName: "text-xxxs"
                                                })]
                                            })]
                                        })
                                    })]
                                })
                            }) : v ? (0, r.jsxs)("div", {
                                className: "px-2 py-2 pointer-events-auto",
                                children: [(0, r.jsxs)("div", {
                                    className: "mb-2 rounded-lg border border-input bg-background/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground",
                                    children: ["This line is set at ", (0, r.jsx)("span", {
                                        className: "font-bold tabular-nums text-primary",
                                        children: v.line
                                    }), " on", " ", (0, r.jsx)("span", {
                                        className: "inline-flex translate-y-[3px] items-baseline",
                                        children: (0, r.jsx)(F.Z, {
                                            appName: v.baseApp,
                                            size: 14
                                        })
                                    }), " ", (0, r.jsx)("span", {
                                        className: "font-semibold text-primary",
                                        children: tY(v.baseApp)
                                    }), " for a fixed payout, but", " ", (0, r.jsx)("span", {
                                        className: "inline-flex translate-y-[3px] items-baseline",
                                        children: (0, r.jsx)(F.Z, {
                                            appName: v.neighbor.app,
                                            size: 14
                                        })
                                    }), " ", (0, r.jsx)("span", {
                                        className: "font-semibold text-primary",
                                        children: tY(v.neighbor.app)
                                    }), " has", " ", v.neighbor.modifier ? (0, r.jsxs)(r.Fragment, {
                                        children: ["a", " ", (0, r.jsx)("span", {
                                            className: "font-bold ".concat("goblin" === v.neighbor.modifier ? "text-emerald-300" : "text-red-300"),
                                            children: v.neighbor.modifier
                                        }), " ", "line at ", (0, r.jsx)("span", {
                                            className: "font-bold tabular-nums text-primary",
                                            children: v.neighbor.line
                                        }), "."]
                                    }) : (0, r.jsxs)(r.Fragment, {
                                        children: ["it favored the ", v.direction, " at", " ", (0, r.jsx)("span", {
                                            className: "font-bold tabular-nums text-primary",
                                            children: v.neighbor.line
                                        }), "number" == typeof ee && (0, r.jsxs)(r.Fragment, {
                                            children: [" ", "with odds of", " ", (0, r.jsx)("span", {
                                                className: "font-bold tabular-nums text-green-400",
                                                children: tb(ee)
                                            })]
                                        }), "."]
                                    }), " ", "Taking the", " ", (0, r.jsx)("span", {
                                        className: "font-semibold text-emerald-300",
                                        children: "over" === v.direction ? "Over" : "Under"
                                    }), " on", " ", tY(v.baseApp), " at", " ", (0, r.jsx)("span", {
                                        className: "font-bold tabular-nums text-emerald-300",
                                        children: v.line
                                    }), " may be good value, but double check the alt lines and stats before you play it."]
                                }), (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-2",
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex flex-col gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 overflow-hidden",
                                        children: [(0, r.jsxs)("span", {
                                            className: "text-xxs text-emerald-300/80",
                                            children: ["Pick on ", tY(v.baseApp)]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex items-center justify-between gap-1.5",
                                            children: [(0, r.jsx)(F.Z, {
                                                appName: v.baseApp,
                                                size: 20
                                            }), (0, r.jsxs)("span", {
                                                className: "text-xs font-bold tabular-nums text-emerald-300",
                                                children: ["over" === v.direction ? "O" : "U", " ", v.line]
                                            })]
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "flex flex-col gap-1 rounded-lg border border-input bg-background/40 px-3 py-2 overflow-hidden",
                                        children: [(0, r.jsxs)("span", {
                                            className: "text-xxs text-muted-foreground",
                                            children: [tY(v.neighbor.app), " has"]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex items-center justify-between gap-1.5",
                                            children: [(0, r.jsx)(F.Z, {
                                                appName: v.neighbor.app,
                                                size: 20,
                                                modifier: v.neighbor.modifier
                                            }), (0, r.jsxs)("span", {
                                                className: "text-xs font-bold tabular-nums text-primary",
                                                children: [v.neighbor.modifier ? "" : "over" === v.direction ? "O " : "U ", v.neighbor.line, !v.neighbor.modifier && "number" == typeof ee && (0, r.jsx)("span", {
                                                    className: "ml-1 text-[11px] font-semibold text-green-400",
                                                    children: tb(ee)
                                                })]
                                            })]
                                        })]
                                    })]
                                })]
                            }) : (0, r.jsx)("div", {
                                className: "flex items-center px-3 pb-2 pt-1 min-w-0 pointer-events-auto",
                                children: (0, r.jsxs)(eO.x, {
                                    className: "flex-1 min-w-0",
                                    children: [(0, r.jsx)("div", {
                                        className: "flex items-center gap-1 h-10 flex-nowrap min-w-max",
                                        children: (0, r.jsx)(eD.E, {
                                            appsOrder: k,
                                            prop: u,
                                            count: 15
                                        })
                                    }), (0, r.jsx)(eO.B, {
                                        orientation: "horizontal"
                                    })]
                                })
                            })]
                        })]
                    }) : (0, r.jsx)(r.Fragment, {})
                }),
                sg = (0, a.memo)(function(e) {
                    let {
                        discrepancy: t
                    } = e;
                    return (0, r.jsx)(sf, {
                        prop: t,
                        sport: t.sport,
                        all: !0,
                        source: "discrepancies"
                    })
                }),
                sb = (0, a.memo)(function(e) {
                    let {
                        pick: t
                    } = e;
                    return (0, r.jsx)(sf, {
                        prop: t.boardProp,
                        sport: t.boardProp.sport,
                        all: !0,
                        source: "positive-ev",
                        valuePick: t
                    })
                }),
                sv = e => {
                    let t = ["th", "st", "nd", "rd"],
                        s = e % 100;
                    return e + (t[(s - 20) % 10] || t[s] || "th")
                },
                sj = (e, t, s) => {
                    let r = {
                        nba: 30,
                        nfl: 32,
                        nhl: 32,
                        cfb: 120,
                        wnba: 13,
                        cbb: 361,
                        mlb: 30
                    }[t];
                    return r && s.defenseRank ? c.Z.scale("mlb" === t ? ["#22c55e", "#facc15", "#ef4444"] : ["#ef4444", "#facc15", "#22c55e"]).domain([1, r])(e).hex() : "#00ff00"
                },
                sw = (0, a.memo)(function(e) {
                    var t;
                    let {
                        stat: s,
                        value: a,
                        threshold: l,
                        showPercent: i,
                        subValue: o,
                        colorMode: d
                    } = e, c = -1 === a && !["STRK", "AVG", "Diff"].includes(s), u = i && Number.isFinite(a) ? Math.round(a) : a, m = null != d ? d : "STRK" === s ? "streak" : "threshold", p = i && !c ? a <= 34 ? "from-red-600/60 to-transparent text-red-300 border-red-600" : a <= 47 ? "from-orange-600/60 to-transparent text-orange-300 border-orange-600" : a <= 52 ? "from-gray-500/60 to-transparent text-gray-300 border-gray-600" : a <= 64 ? "from-yellow-600/60 to-transparent text-yellow-300 border-yellow-600" : "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : null, x = (0, n.Z)("relative flex-1 basis-0 min-w-0 h-[52px] bg-gradient-to-t border-b-2 px-0.5 py-1.5 flex items-center justify-center overflow-hidden leading-none", null !== (t = null != p ? p : "streak" === m ? a < 0 ? "from-red-600/60 to-transparent text-red-300 border-red-600 font-bold" : a <= 1 ? "from-yellow-600/60 to-transparent text-yellow-300 border-yellow-600" : a <= 2 ? "from-lime-600/60 to-transparent text-lime-300 border-lime-600" : "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : null) && void 0 !== t ? t : "threshold" === m && (c || a === l) ? "from-gray-500/60 to-transparent text-gray-300 border-gray-600" : "threshold" === m && a > l ? "from-emerald-600/60 to-transparent text-emerald-300 border-emerald-600 font-bold" : "threshold" === m ? "from-red-600/60 to-transparent text-red-300 border-red-600" : null);
                    return (0, r.jsxs)("div", {
                        className: x,
                        children: [(0, r.jsxs)("div", {
                            className: "flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5",
                            children: [(0, r.jsx)("h4", {
                                className: "max-w-full truncate text-xxs leading-none text-slate-400",
                                children: s
                            }), (0, r.jsxs)("p", {
                                className: "max-w-full truncate text-xs leading-none tabular-nums",
                                children: [c ? "-" : u, !c && i ? "%" : ""]
                            })]
                        }), o && !c && (0, r.jsx)("span", {
                            className: "absolute bottom-1 left-0 right-0 mx-auto max-w-full truncate px-0.5 text-center text-[8px] font-medium leading-none opacity-80 tabular-nums",
                            children: o
                        })]
                    })
                }),
                sN = "h-[58px] px-px py-0 align-middle",
                sy = 'a, button, input, textarea, select, [role="button"], [data-row-click-ignore="true"]',
                sk = (0, a.memo)(function(e) {
                    var t, s, i, c;
                    let {
                        prop: u,
                        index: m,
                        sport: p,
                        all: x,
                        appsOrder: h,
                        isPublicPreview: f,
                        publicFavoriteLabel: g,
                        onPublicFavorite: b
                    } = e, v = (0, ek.useRouter)(), {
                        setScrollPosition: j
                    } = (0, eI.v)(), {
                        addFavorite: w,
                        removeFavorite: N,
                        favoritesLoading: y,
                        favoriteIdToFavorite: k
                    } = (0, d.r)(), [C, F] = (0, a.useState)(!1), {
                        line: _,
                        stat: S,
                        averageLast10: R,
                        differenceLast10: Z,
                        differencePercent: A,
                        hitRateLast5: P,
                        hitRateLast10: L,
                        hitRateLast15: D,
                        hitRateH2H: O,
                        h2hHits: z,
                        h2hGames: I,
                        streak: T,
                        hrSeason: E
                    } = u, V = null == k ? void 0 : k[u.groupKey], B = "/players/".concat(p, "/").concat(u.player_id, "?from=").concat(x ? "all" : "props", "&prop=").concat(encodeURIComponent(u.groupKey)), H = (0, a.useCallback)(() => {
                        let e = document.getElementById("desktop-props-container");
                        e && j(e.scrollTop)
                    }, [j]), W = (0, a.useCallback)(e => {
                        var t;
                        let s = e.target;
                        !(s instanceof Element && s.closest(sy)) && (null !== (t = window.getSelection()) && void 0 !== t && t.toString() || (H(), v.push(B)))
                    }, [B, v, H]), G = (0, a.useCallback)(e => {
                        if (e.defaultPrevented || "Enter" !== e.key && " " !== e.key) return;
                        let t = e.target;
                        t instanceof Element && t.closest(sy) || (e.preventDefault(), H(), v.push(B))
                    }, [B, v, H]);
                    return (0, r.jsxs)("tr", {
                        className: "even:bg-new-bg/50 odd:card-bg text-primary cursor-pointer transition-colors hover:bg-highlight/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-inset",
                        role: "link",
                        tabIndex: 0,
                        "aria-label": "View ".concat(u.player_name, " details"),
                        onClick: W,
                        onKeyDown: G,
                        children: [(0, r.jsx)("td", {
                            className: "pl-4 py-3 text-xs font-normal whitespace-nowrap flex items-center gap-2",
                            children: (0, r.jsxs)("div", {
                                className: "flex gap-2.5 items-center",
                                children: [(0, r.jsxs)("div", {
                                    className: "relative",
                                    children: [(0, r.jsx)(eT.A, {
                                        playerId: u.player_id,
                                        playerName: u.player_name,
                                        imageUrl: u.player_image,
                                        size: 36,
                                        className: "border border-slate-600/50",
                                        sport: p,
                                        priority: !0
                                    }), (0, r.jsxs)(M.J2, {
                                        open: C,
                                        onOpenChange: F,
                                        children: [(0, r.jsx)(M.xo, {
                                            className: (0, n.Z)("absolute -bottom-1.5 -right-1.5 transition-all ease-in animate rounded-full border bg-gradient-to-b from-highlight to-highlight/40 w-6 h-6 grid place-items-center", V ? "border-blue-400" : "border-input"),
                                            children: (0, r.jsx)(eb.Z, {
                                                className: (0, n.Z)("w-3 h-3", V ? "text-blue-400 fill-blue-400" : "text-muted-foreground")
                                            })
                                        }), (0, r.jsx)(M.yk, {
                                            className: "w-max bg-gradient-to-br from-input-bg/95 to-input-bg/60 backdrop-blur-sm border-2 border-white/10 rounded-xl shadow-2xl p-3",
                                            children: (0, r.jsx)("div", {
                                                className: "flex flex-col gap-2",
                                                children: f ? (0, r.jsx)("button", {
                                                    onClick: () => {
                                                        null == b || b(), F(!1)
                                                    },
                                                    className: "blue-button grid place-items-center rounded-lg py-1.5 px-4 text-sm font-semibold transition-all hover:scale-[1.02]",
                                                    children: null != g ? g : "Unlock"
                                                }) : y ? (0, r.jsx)("div", {
                                                    className: "px-4 py-2 flex justify-center",
                                                    children: (0, r.jsx)(eg.Z, {
                                                        className: "w-6 h-6 animate-spin text-blue-500"
                                                    })
                                                }) : V ? (0, r.jsxs)(r.Fragment, {
                                                    children: [(0, r.jsx)("div", {
                                                        className: "text-center",
                                                        children: (0, r.jsx)("p", {
                                                            className: "text-xs text-muted-foreground",
                                                            children: "Manage Favorite"
                                                        })
                                                    }), (0, r.jsx)("button", {
                                                        onClick: async () => {
                                                            await N(u.groupKey), F(!1)
                                                        },
                                                        className: "bg-gradient-to-t from-red-600/90 to-red-500/90 hover:from-red-600 hover:to-red-500 rounded-lg py-1.5 px-4 border border-red-400/30 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-red-500/20",
                                                        children: "Remove"
                                                    })]
                                                }) : (0, r.jsxs)(r.Fragment, {
                                                    children: [(0, r.jsx)("div", {
                                                        className: "text-center",
                                                        children: (0, r.jsx)("p", {
                                                            className: "text-xs text-muted-foreground",
                                                            children: "Add to Pick Builder"
                                                        })
                                                    }), (0, r.jsxs)("div", {
                                                        className: "flex gap-2 flex-col",
                                                        children: [(0, r.jsx)("button", {
                                                            onClick: async () => {
                                                                await w(u, "over"), F(!1)
                                                            },
                                                            className: "over-button grid place-items-center shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all !py-1 !px-4 !text-sm gap-1.5",
                                                            children: (0, r.jsxs)("div", {
                                                                className: "flex gap-2 items-center",
                                                                children: [(0, r.jsx)(ev.Z, {
                                                                    className: "w-3.5 h-3.5"
                                                                }), "Over"]
                                                            })
                                                        }), (0, r.jsx)("button", {
                                                            onClick: async () => {
                                                                await w(u, "under"), F(!1)
                                                            },
                                                            className: "under-button shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all !py-1 !px-4 !text-sm grid place-items-center gap-1.5",
                                                            children: (0, r.jsxs)("div", {
                                                                className: "flex gap-2 items-center",
                                                                children: [(0, r.jsx)(ej.Z, {
                                                                    className: "w-3.5 h-3.5"
                                                                }), "Under"]
                                                            })
                                                        })]
                                                    })]
                                                })
                                            })
                                        })]
                                    })]
                                }), (0, r.jsx)(ey.default, {
                                    href: B,
                                    onClick: H,
                                    prefetch: !1,
                                    children: (0, r.jsxs)("div", {
                                        className: "flex flex-col",
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex items-center gap-1.5 text-primary",
                                            children: [(0, r.jsxs)("div", {
                                                className: "flex items-center gap-1 cursor-pointer",
                                                children: [(0, r.jsxs)("p", {
                                                    className: "font-semibold",
                                                    children: [u.player_name, tv(u.team.rank)]
                                                }), u.player_position && "(".concat((null === (i = e_.ZP[p]) || void 0 === i ? void 0 : null === (s = i.positionMap) || void 0 === s ? void 0 : s[null === (t = u.player_position) || void 0 === t ? void 0 : t.toLowerCase()]) || (null === (c = u.player_position) || void 0 === c ? void 0 : c.toUpperCase()), ")")]
                                            }), (0, r.jsx)(eF.pn, {
                                                delayDuration: 300,
                                                children: (0, r.jsxs)(eF.u, {
                                                    children: [(0, r.jsx)(eF.aJ, {
                                                        asChild: !0,
                                                        children: (0, r.jsx)("span", {
                                                            className: "text-xxs text-muted-foreground max-w-[150px] truncate inline-block h-min",
                                                            children: "tennis" === p ? "vs ".concat(tS(u.opponent.name)).concat(tv(u.opponent.rank)) : u.game_string
                                                        })
                                                    }), (0, r.jsx)(eF._v, {
                                                        children: o()(u.start_date).format("ddd @ h:mmA")
                                                    })]
                                                })
                                            })]
                                        }), (0, r.jsxs)("p", {
                                            className: "text-muted-foreground inline-flex items-center gap-1",
                                            children: [x && (0, r.jsx)(eS.C, {
                                                sport: p
                                            }), (0, r.jsx)("span", {
                                                className: "text-white",
                                                children: _
                                            }), " ", (0, r.jsx)("span", {
                                                className: "font-medium",
                                                children: S
                                            }), " "]
                                        })]
                                    })
                                })]
                            })
                        }), (0, r.jsx)("td", {
                            className: "px-4 py-4 text-sm font-normal whitespace-nowrap",
                            children: (0, r.jsx)(eD.E, {
                                prop: u,
                                appsOrder: h,
                                count: 2
                            })
                        }), (0, r.jsx)("td", {
                            className: "px-4 py-4 text-sm font-normal whitespace-nowrap",
                            children: (0, r.jsx)("div", {
                                className: "grid place-items-center",
                                children: u.team_ml_percent && u.team_ml_percent > 0 ? (0, r.jsx)(ed, {
                                    winChance: 100 * u.team_ml_percent
                                }) : (0, r.jsx)("p", {
                                    className: "grid place-items-center text-muted-foreground",
                                    children: "-"
                                })
                            })
                        }), (x || eU.includes(p)) && (0, r.jsx)("td", {
                            className: "text-center px-4 py-4 text-xs font-normal whitespace-nowrap",
                            children: u.defenseRank > 0 ? (0, r.jsxs)("span", {
                                className: (0, n.Z)("inline-flex mx-auto border bg-gradient-to-r from-gray-700/30 to-gray-600/30 items-center gap-1 px-2 py-1 text-xxs rounded-full shadow-sm transition-colors"),
                                style: {
                                    color: sj(u.defenseRank, u.sport || p, u),
                                    borderColor: sj(u.defenseRank, u.sport || p, u)
                                },
                                title: "mlb" === (u.sport || p) ? "Opposing lineup's season strikeout-rate rank — 1st strikes out the most (softest K matchup)" : "Opponent's defense rank vs this stat — 1st is the toughest matchup",
                                children: [(0, r.jsx)(U.Z, {
                                    className: "h-3 w-3 shrink-0"
                                }), sv(u.defenseRank)]
                            }) : (0, r.jsx)("span", {
                                className: "inline-flex items-center px-2 py-1 text-xs font-semibold text-muted-foreground",
                                children: "N/A"
                            })
                        }), (0, r.jsx)("td", {
                            className: "px-1",
                            children: (0, r.jsx)(ez.EZ, {
                                prop: u
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: (0, r.jsx)(l, {
                                value: R && +R,
                                middleThreshold: _ ? +_ : 0
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: (0, r.jsx)(l, {
                                value: Z && +Z,
                                middleThreshold: 0,
                                subValue: tf(A)
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: -1 !== P ? (0, r.jsx)(l, {
                                value: P && +P,
                                middleThreshold: 50,
                                showPercent: !0
                            }) : (0, r.jsx)("p", {
                                className: "grid h-full place-items-center text-muted-foreground",
                                children: "-"
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: -1 !== L ? (0, r.jsx)(l, {
                                value: L && +L,
                                middleThreshold: 50,
                                showPercent: !0
                            }) : (0, r.jsx)("p", {
                                className: "grid h-full place-items-center text-muted-foreground",
                                children: "-"
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: -1 !== D ? (0, r.jsx)(l, {
                                value: D && +D,
                                middleThreshold: 50,
                                showPercent: !0
                            }) : (0, r.jsx)("p", {
                                className: "grid h-full place-items-center text-muted-foreground",
                                children: "-"
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: -1 !== O ? (0, r.jsx)(l, {
                                value: O && +O,
                                middleThreshold: 50,
                                showPercent: !0,
                                subValue: tg({
                                    h2hHits: z,
                                    h2hGames: I
                                })
                            }) : (0, r.jsx)("p", {
                                className: "grid h-full place-items-center text-muted-foreground",
                                children: "-"
                            })
                        }), (0, r.jsx)("td", {
                            className: sN,
                            children: (0, r.jsx)(l, {
                                value: T && +T,
                                middleThreshold: 3,
                                colorMode: "streak"
                            })
                        }), (x || eU.includes(p) || "cod" === p || "soccer" === p) && (0, r.jsx)("td", {
                            className: sN,
                            children: -1 !== E ? (0, r.jsx)(l, {
                                value: E && +E,
                                middleThreshold: 50,
                                showPercent: !0
                            }) : (0, r.jsx)("p", {
                                className: "grid h-full place-items-center text-muted-foreground",
                                children: "-"
                            })
                        })]
                    }, m)
                }),
                sC = (0, a.memo)(function(e) {
                    let {
                        prop: t,
                        showTrendingCount: s,
                        isPublicPreview: n,
                        publicFavoriteLabel: a,
                        onPublicFavorite: l
                    } = e;
                    return (0, r.jsx)(sf, {
                        prop: t,
                        source: "popular",
                        showTrendingCount: s,
                        isPublicPreview: n,
                        publicFavoriteLabel: a,
                        onPublicFavorite: l
                    })
                })
        },
        54586: function(e, t, s) {
            s.d(t, {
                W: function() {
                    return d
                }
            });
            var r = s(10131),
                n = s(55185),
                a = s(63855),
                l = s(28876),
                i = s(68886),
                o = s(58685);

            function d(e) {
                let {
                    children: t,
                    contentClassName: s,
                    open: d,
                    onOpenChange: c,
                    title: u = "PickFinder Pro Video Guide",
                    description: m = "A full walkthrough of Arbitrage, Middles and EV+ — how each Pro tool works and how to use them to find profitable bets."
                } = e, [p, x] = (0, n.useState)(!1), {
                    openProGate: h
                } = (0, i.An)(), {
                    state: f
                } = (0, i.sx)();
                return (0, r.jsxs)(a.Vq, {
                    open: null != d ? d : p,
                    onOpenChange: e => {
                        void 0 === d && x(e), null == c || c(e), e || !l.gT || f.hasPro || h("video_guide")
                    },
                    children: [t ? (0, r.jsx)(a.hg, {
                        asChild: !0,
                        children: t
                    }) : null, (0, r.jsxs)(a.cZ, {
                        className: (0, o.cn)("sm:max-w-[700px]", s),
                        children: [(0, r.jsxs)(a.fK, {
                            children: [(0, r.jsx)(a.$N, {
                                children: u
                            }), (0, r.jsx)(a.Be, {
                                children: m
                            })]
                        }), (0, r.jsx)("div", {
                            className: "grid h-full w-full gap-4 py-4",
                            children: (0, r.jsx)("iframe", {
                                src: "https://www.youtube.com/embed/6LBz0uU-fv0",
                                title: "PickFinder Pro Video Guide",
                                allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                allowFullScreen: !0,
                                width: "100%",
                                height: "100%",
                                className: "aspect-video rounded-lg border border-white/[0.08]"
                            })
                        })]
                    })]
                })
            }
        },
        98842: function(e, t, s) {
            s.d(t, {
                f: function() {
                    return d
                }
            });
            var r = s(10131);
            s(55185);
            var n = s(2663),
                a = s(30950),
                l = s(58685),
                i = s(69687);
            let o = e => {
                let t = new Date;
                return t.setHours(0, 0, 0, 0), e < t
            };

            function d(e) {
                let {
                    className: t,
                    classNames: s,
                    showOutsideDays: d = !0,
                    ...c
                } = e;
                return (0, r.jsx)(a._W, {
                    showOutsideDays: d,
                    disabled: o,
                    className: (0, l.cn)("p-3", t),
                    classNames: {
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: (0, l.cn)((0, i.d)({
                            variant: "outline"
                        }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: (0, l.cn)("relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md", "range" === c.mode ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md" : "[&:has([aria-selected])]:rounded-md"),
                        day: (0, l.cn)((0, i.d)({
                            variant: "ghost"
                        }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
                        day_range_start: "day-range-start",
                        day_range_end: "day-range-end",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "day-outside text-muted-foreground opacity-50  aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                        ...s
                    },
                    components: {
                        IconLeft: e => {
                            let { ...t
                            } = e;
                            return (0, r.jsx)(n.wyc, {
                                className: "h-4 w-4"
                            })
                        },
                        IconRight: e => {
                            let { ...t
                            } = e;
                            return (0, r.jsx)(n.XCv, {
                                className: "h-4 w-4"
                            })
                        }
                    },
                    ...c
                })
            }
            d.displayName = "Calendar"
        },
        46434: function(e, t, s) {
            s.d(t, {
                $F: function() {
                    return d
                },
                AW: function() {
                    return c
                },
                Ju: function() {
                    return m
                },
                VD: function() {
                    return p
                },
                Xi: function() {
                    return u
                },
                h_: function() {
                    return o
                }
            });
            var r = s(10131),
                n = s(55185),
                a = s(55950),
                l = s(2663),
                i = s(58685);
            let o = a.fC,
                d = a.xz;
            a.ZA, a.Uv, a.Tr, a.Ee, n.forwardRef((e, t) => {
                let {
                    className: s,
                    inset: n,
                    children: o,
                    ...d
                } = e;
                return (0, r.jsxs)(a.fF, {
                    ref: t,
                    className: (0, i.cn)("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent", n && "pl-8", s),
                    ...d,
                    children: [o, (0, r.jsx)(l.XCv, {
                        className: "ml-auto h-4 w-4"
                    })]
                })
            }).displayName = a.fF.displayName, n.forwardRef((e, t) => {
                let {
                    className: s,
                    ...n
                } = e;
                return (0, r.jsx)(a.tu, {
                    ref: t,
                    className: (0, i.cn)("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", s),
                    ...n
                })
            }).displayName = a.tu.displayName;
            let c = n.forwardRef((e, t) => {
                let {
                    className: s,
                    sideOffset: n = 4,
                    ...l
                } = e;
                return (0, r.jsx)(a.Uv, {
                    children: (0, r.jsx)(a.VY, {
                        ref: t,
                        sideOffset: n,
                        className: (0, i.cn)("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-input-bg border-input-border p-1 text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", s),
                        ...l
                    })
                })
            });
            c.displayName = a.VY.displayName;
            let u = n.forwardRef((e, t) => {
                let {
                    className: s,
                    inset: n,
                    ...l
                } = e;
                return (0, r.jsx)(a.ck, {
                    ref: t,
                    className: (0, i.cn)("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-slate-700/40 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", n && "pl-8", s),
                    ...l
                })
            });
            u.displayName = a.ck.displayName, n.forwardRef((e, t) => {
                let {
                    className: s,
                    children: n,
                    checked: o,
                    ...d
                } = e;
                return (0, r.jsxs)(a.oC, {
                    ref: t,
                    className: (0, i.cn)("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", s),
                    checked: o,
                    ...d,
                    children: [(0, r.jsx)("span", {
                        className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                        children: (0, r.jsx)(a.wU, {
                            children: (0, r.jsx)(l.nQG, {
                                className: "h-4 w-4"
                            })
                        })
                    }), n]
                })
            }).displayName = a.oC.displayName, n.forwardRef((e, t) => {
                let {
                    className: s,
                    children: n,
                    ...o
                } = e;
                return (0, r.jsxs)(a.Rk, {
                    ref: t,
                    className: (0, i.cn)("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", s),
                    ...o,
                    children: [(0, r.jsx)("span", {
                        className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                        children: (0, r.jsx)(a.wU, {
                            children: (0, r.jsx)(l.jXb, {
                                className: "h-4 w-4 fill-current"
                            })
                        })
                    }), n]
                })
            }).displayName = a.Rk.displayName;
            let m = n.forwardRef((e, t) => {
                let {
                    className: s,
                    inset: n,
                    ...l
                } = e;
                return (0, r.jsx)(a.__, {
                    ref: t,
                    className: (0, i.cn)("px-2 py-1.5 text-sm font-semibold !text-muted-foreground", n && "pl-8", s),
                    ...l
                })
            });
            m.displayName = a.__.displayName;
            let p = n.forwardRef((e, t) => {
                let {
                    className: s,
                    ...n
                } = e;
                return (0, r.jsx)(a.Z0, {
                    ref: t,
                    className: (0, i.cn)("-mx-1 my-1 h-px bg-muted", s),
                    ...n
                })
            });
            p.displayName = a.Z0.displayName
        },
        68886: function(e, t, s) {
            s.d(t, {
                An: function() {
                    return p
                },
                D3: function() {
                    return m
                },
                sx: function() {
                    return x
                }
            });
            var r = s(10131),
                n = s(55185),
                a = s(69237),
                l = s(67057),
                i = s(28876),
                o = s(14375),
                d = s(44209),
                c = s(8933);
            let u = (0, n.createContext)(null);

            function m(e) {
                let {
                    children: t
                } = e, [s, a] = (0, n.useState)(!1), [l, i] = (0, n.useState)(void 0), [m, p] = (0, n.useState)(!1), [h, f] = (0, n.useState)(void 0), [g, b] = (0, n.useState)(void 0), [v, j] = (0, n.useState)(!1), [w, N] = (0, n.useState)(!1), [y, k] = (0, n.useState)(void 0), [C, M] = (0, n.useState)(void 0), {
                    state: F
                } = x(), _ = F.hasPaid, S = (0, n.useCallback)(e => {
                    k(null == e ? void 0 : e.interval), M(null == e ? void 0 : e.source), N(!0)
                }, []), R = (0, n.useCallback)(e => {
                    if (!_) {
                        S({
                            source: e
                        });
                        return
                    }
                    i(e), a(!0)
                }, [_, S]), Z = (0, n.useCallback)(e => {
                    if (!_) {
                        S(e);
                        return
                    }
                    f(null == e ? void 0 : e.interval), b(null == e ? void 0 : e.source), p(!0)
                }, [_, S]), A = (0, n.useCallback)(() => j(!0), []), P = (0, n.useCallback)(e => {
                    _ ? F.isTrialEligible ? R(e) : Z({
                        source: e
                    }) : S({
                        source: e
                    })
                }, [_, S, R, Z, F.isTrialEligible]), L = (0, n.useMemo)(() => ({
                    openProTrial: R,
                    openProUpgrade: Z,
                    openProTrialStatus: A,
                    openProGate: P
                }), [P, R, A, Z]);
                return (0, r.jsxs)(u.Provider, {
                    value: L,
                    children: [t, (0, r.jsx)(d.N3, {
                        open: s,
                        onOpenChange: a,
                        source: l
                    }), (0, r.jsx)(o.FY, {
                        open: m,
                        onOpenChange: p,
                        defaultInterval: h,
                        source: g
                    }), (0, r.jsx)(d.IY, {
                        open: v,
                        onOpenChange: j,
                        onUpgrade: () => {
                            j(!1), Z({
                                source: "trial_status"
                            })
                        }
                    }), (0, r.jsx)(c.Ei, {
                        open: w,
                        onOpenChange: N,
                        defaultTier: "pro",
                        defaultInterval: y,
                        signedOutBehavior: "paywall-first",
                        source: null != C ? C : "pro_gate"
                    })]
                })
            }

            function p() {
                let e = (0, n.useContext)(u),
                    t = (0, l.useRouter)();
                return (0, n.useMemo)(() => {
                    if (e) return e;
                    let s = e => {
                        let s = (null == e ? void 0 : e.interval) ? "?interval=".concat(e.interval) : "";
                        t.push("".concat(i.MP).concat(s))
                    };
                    return {
                        openProTrial: () => s(),
                        openProUpgrade: s,
                        openProTrialStatus: () => s(),
                        openProGate: () => s()
                    }
                }, [e, t])
            }

            function x() {
                var e;
                let {
                    user: t,
                    isLoaded: s,
                    isSignedIn: r
                } = (0, a.aF)(), [l, o] = (0, n.useState)(!1), [d, c] = (0, n.useState)(() => Date.now());
                (0, n.useEffect)(() => {
                    o(!0);
                    let e = setInterval(() => c(Date.now()), 6e4);
                    return () => clearInterval(e)
                }, []);
                let u = null !== (e = null == t ? void 0 : t.publicMetadata) && void 0 !== e ? e : null,
                    m = (0, n.useMemo)(() => (0, i.qH)(u, d), [u, d]);
                return {
                    user: t,
                    isLoaded: s,
                    isSignedIn: !!r,
                    mounted: l,
                    metadata: u,
                    state: m
                }
            }
        },
        77606: function(e, t, s) {
            s.d(t, {
                I: function() {
                    return l
                },
                v: function() {
                    return i
                }
            });
            var r = s(10131),
                n = s(55185);
            let a = (0, n.createContext)({});

            function l(e) {
                let {
                    children: t
                } = e, [s, l] = (0, n.useState)(0), [i, o] = (0, n.useState)(0), [d, c] = (0, n.useState)(0), u = (0, n.useMemo)(() => ({
                    scrollPosition: s,
                    discrepanciesScrollPosition: i,
                    trendingScrollPosition: d,
                    setScrollPosition: l,
                    setDiscrepanciesScrollPosition: o,
                    setTrendingScrollPosition: c
                }), [s, i, d]);
                return (0, r.jsx)(a.Provider, {
                    value: u,
                    children: t
                })
            }
            let i = () => (0, n.useContext)(a)
        },
        94300: function(e, t, s) {
            s.d(t, {
                s: function() {
                    return r
                }
            });
            let r = e => {
                let t = new URLSearchParams;
                return Object.entries(e).forEach(e => {
                    let [s, r] = e;
                    void 0 !== r && "" !== r && (Array.isArray(r) ? r.length > 0 && t.append(s, r.join(",")) : t.append(s, r.toString()))
                }), t.toString()
            }
        }
    }
]);