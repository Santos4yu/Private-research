"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [1592], {
        55212: function(s, t, e) {
            e.d(t, {
                A: function() {
                    return n
                }
            });
            var a = e(10131),
                r = e(75775),
                i = e(63210),
                o = e(55185);
            let n = (0, o.memo)(function(s) {
                let {
                    playerId: t,
                    playerName: e,
                    sport: n,
                    imageUrl: p,
                    size: l = 40,
                    className: d,
                    imageClassName: c,
                    variant: _ = "gradient",
                    priority: u = !1
                } = s, [y, h] = (0, o.useState)(!1), m = (n || "").toLowerCase();
                return (0, o.useEffect)(() => {
                    h(!1)
                }, [t, p]), (0, a.jsx)("div", {
                    className: (0, i.Z)("relative rounded-full overflow-hidden flex-shrink-0", "gradient" === _ ? "bg-gradient-to-br from-slate-700 to-slate-800" : "card" === _ ? "bg-card" : "", d),
                    style: {
                        width: l,
                        height: l
                    },
                    children: (0, a.jsx)(r.default, {
                        src: y || (null == p ? void 0 : p.includes("unknown.jpg")) ? "https://assets.pickfinder.app/players/fallback.png" : p || "https://assets.pickfinder.app/players/".concat(t, ".png"),
                        alt: e || "Player",
                        width: l,
                        height: l,
                        className: (0, i.Z)("w-full h-full object-cover object-top transition-transform", ("nba" === m || "nfl" === m || "cfb" === m) && !y && "scale-110", c),
                        onError: () => h(!0),
                        unoptimized: !0,
                        priority: u
                    })
                })
            });
            n.displayName = "PlayerAvatar"
        },
        47288: function(s, t, e) {
            var a = e(10131),
                r = e(63210),
                i = e(75775),
                o = e(55185);
            t.Z = (0, o.memo)(function(s) {
                var t, e;
                let {
                    appName: i,
                    size: o = 24,
                    outcomes: d,
                    outcomesClassName: c,
                    fromFavorites: _,
                    forceRow: u,
                    modifier: y
                } = s;
                return y = y || (null == d ? void 0 : null === (t = d.over) || void 0 === t ? void 0 : t.modifier) || (null == d ? void 0 : null === (e = d.under) || void 0 === e ? void 0 : e.modifier), (0, a.jsxs)("div", {
                    className: "flex gap-1 items-center w-max",
                    children: [(0, a.jsxs)("div", {
                        className: (0, r.Z)(u ? "flex items-center" : "relative w-max"),
                        children: [i && (0, a.jsx)(n, {
                            app: i,
                            size: o
                        }), y && "multipliers" !== y && i && !u && (!_ || !y.includes(".")) && (0, a.jsx)("div", {
                            className: "absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3",
                            children: (0, a.jsx)(p, {
                                modifier: y,
                                size: o / 1.4
                            })
                        }), y && (u || !i) && (0, a.jsx)(p, {
                            modifier: y,
                            size: o
                        })]
                    }), d && ((null == i ? void 0 : i.toLowerCase()) !== "prizepicks" || !y) && (0, a.jsx)(l, {
                        data: d,
                        className: c
                    })]
                })
            });
            let n = (0, o.memo)(function(s) {
                    let {
                        app: t,
                        size: e
                    } = s;
                    return (0, a.jsx)("img", {
                        src: "/logos/".concat(null == t ? void 0 : t.toLowerCase(), ".png"),
                        width: e,
                        height: e,
                        alt: t
                    })
                }),
                p = (0, o.memo)(function(s) {
                    let {
                        modifier: t,
                        size: e
                    } = s;
                    return t && "multipliers" !== t ? t.toString().includes("x") ? (0, a.jsx)("span", {
                        className: "flex text-xs items-center py-0.5 px-1.5 rounded-full bg-gradient-to-b from-yellow-500 to-orange-500 text-black font-bold",
                        children: t
                    }) : (0, a.jsx)(i.default, {
                        src: "/modifiers/".concat(t, ".").concat("none" === t ? "svg" : "png?v=2"),
                        width: e,
                        height: e,
                        alt: t.toString()
                    }) : null
                }),
                l = (0, o.memo)(function(s) {
                    let {
                        data: t,
                        className: e
                    } = s;
                    return t && (t.under || t.over) ? (0, a.jsxs)("div", {
                        className: (0, r.Z)("ml-0.5 flex flex-col items-start h-min text-mxs", e),
                        children: [t.over && (0, a.jsxs)("span", {
                            className: "font-semibold text-green-400",
                            children: ["O", (0, a.jsx)("span", {
                                className: "text-gray-300 ml-0.5",
                                children: /^[0-9]+$/.test(String(t.over.price)) ? "+".concat(t.over.price) : t.over.price
                            })]
                        }), t.under && (0, a.jsxs)("span", {
                            className: "font-semibold text-red-400",
                            children: ["U", (0, a.jsx)("span", {
                                className: "text-gray-300 ml-0.5",
                                children: /^[0-9]+$/.test(String(t.under.price)) ? "+".concat(t.under.price) : t.under.price
                            })]
                        })]
                    }) : null
                })
        },
        69687: function(s, t, e) {
            e.d(t, {
                d: function() {
                    return p
                },
                z: function() {
                    return l
                }
            });
            var a = e(10131),
                r = e(55185),
                i = e(33658),
                o = e(60656),
                n = e(58685);
            let p = (0, o.j)("inline-flex items-center transition-all  justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", {
                    variants: {
                        variant: {
                            gradient: "text-primary border border-input bg-gradient-to-b w-full from-gray-800 to-transparent hover:brightness-125 hover:bg-inherit",
                            default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                            destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                            outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                            secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                            blue: "text-primary border border-input bg-gradient-to-t w-full from-blue-800 to-blue-600 hover:brightness-125 hover:bg-inherit",
                            ghost: "hover:bg-accent hover:text-accent-foreground",
                            link: "text-primary underline-offset-4 hover:underline",
                            underline: "rounded-none !h-auto !px-0 !py-1 inline-flex w-min items-start text-left border-b-2 border-transparent hover:brightness-75 justify-center py-1 font-medium transition-all disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm text-slate-400 data-[state=active]:border-white data-[state=active]:text-slate-100"
                        },
                        size: {
                            default: "h-9 px-4 py-2",
                            sm: "h-8 rounded-md px-3 text-xs",
                            lg: "h-10 rounded-md px-8",
                            icon: "h-9 w-9"
                        }
                    },
                    defaultVariants: {
                        variant: "default",
                        size: "default"
                    }
                }),
                l = r.forwardRef((s, t) => {
                    let {
                        className: e,
                        variant: r,
                        size: o,
                        asChild: l = !1,
                        ...d
                    } = s, c = l ? i.g7 : "button";
                    return (0, a.jsx)(c, {
                        className: (0, n.cn)(p({
                            variant: r,
                            size: o,
                            className: e
                        })),
                        ref: t,
                        ...d
                    })
                });
            l.displayName = "Button"
        },
        63855: function(s, t, e) {
            e.d(t, {
                $N: function() {
                    return m
                },
                Be: function() {
                    return g
                },
                GG: function() {
                    return c
                },
                Vq: function() {
                    return p
                },
                cN: function() {
                    return h
                },
                cZ: function() {
                    return u
                },
                fK: function() {
                    return y
                },
                hg: function() {
                    return l
                }
            });
            var a = e(10131),
                r = e(55185),
                i = e(31468),
                o = e(40122),
                n = e(58685);
            let p = i.fC,
                l = i.xz,
                d = i.h_,
                c = i.x8,
                _ = r.forwardRef((s, t) => {
                    let {
                        className: e,
                        ...r
                    } = s;
                    return (0, a.jsx)(i.aV, {
                        ref: t,
                        className: (0, n.cn)("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", e),
                        ...r
                    })
                });
            _.displayName = i.aV.displayName;
            let u = r.forwardRef((s, t) => {
                let {
                    className: e,
                    children: r,
                    ...p
                } = s;
                return (0, a.jsxs)(d, {
                    children: [(0, a.jsx)(_, {}), (0, a.jsxs)(i.VY, {
                        ref: t,
                        className: (0, n.cn)("fixed text-primary left-[50%] top-[50%] z-50 grid w-[90%] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-gradient-to-br from-input-bg/95 to-input-bg/60 backdrop-blur-sm p-6 shadow-2xl rounded-2xl border-2 border-blue-500/20", "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]", e),
                        ...p,
                        children: [r, (0, a.jsxs)(i.x8, {
                            className: "absolute right-4 top-4 rounded-lg opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-white/5 p-1 focus:outline-none focus-visible:outline-none disabled:pointer-events-none",
                            children: [!p.hideClose && (0, a.jsx)(o.Z, {
                                className: "h-5 w-5 text-muted-foreground hover:text-foreground"
                            }), (0, a.jsx)("span", {
                                className: "sr-only",
                                children: "Close"
                            })]
                        })]
                    })]
                })
            });
            u.displayName = i.VY.displayName;
            let y = s => {
                let {
                    className: t,
                    ...e
                } = s;
                return (0, a.jsx)("div", {
                    className: (0, n.cn)("flex flex-col space-y-2 sm:text-left text-center", t),
                    ...e
                })
            };
            y.displayName = "DialogHeader";
            let h = s => {
                let {
                    className: t,
                    ...e
                } = s;
                return (0, a.jsx)("div", {
                    className: (0, n.cn)("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", t),
                    ...e
                })
            };
            h.displayName = "DialogFooter";
            let m = r.forwardRef((s, t) => {
                let {
                    className: e,
                    ...r
                } = s;
                return (0, a.jsx)(i.Dx, {
                    ref: t,
                    className: (0, n.cn)("text-lg font-semibold leading-none tracking-tight text-primary", e),
                    ...r
                })
            });
            m.displayName = i.Dx.displayName;
            let g = r.forwardRef((s, t) => {
                let {
                    className: e,
                    ...r
                } = s;
                return (0, a.jsx)(i.dk, {
                    ref: t,
                    className: (0, n.cn)("text-sm text-muted-foreground", e),
                    ...r
                })
            });
            g.displayName = i.dk.displayName
        },
        6094: function(s, t, e) {
            var a = e(10131),
                r = e(75775);
            t.Z = s => {
                let {
                    width: t,
                    height: e,
                    className: i
                } = s;
                return (0, a.jsx)(r.default, {
                    alt: "logo",
                    priority: !0,
                    src: "/logo-new.png",
                    width: t,
                    height: e,
                    className: i
                })
            }
        },
        28876: function(s, t, e) {
            e.d(t, {
                AM: function() {
                    return m
                },
                IL: function() {
                    return r
                },
                MP: function() {
                    return i
                },
                QS: function() {
                    return y
                },
                Vf: function() {
                    return n
                },
                gT: function() {
                    return o
                },
                nt: function() {
                    return d
                },
                qH: function() {
                    return h
                },
                vR: function() {
                    return p
                },
                y1: function() {
                    return l
                }
            });
            let a = new Set(["User", "Admin", "Friend"]),
                r = "/purchase",
                i = "/upgrade",
                o = !0,
                n = 3,
                p = {
                    default: [],
                    props: [],
                    discrepancies: [],
                    popular: [],
                    altLines: [],
                    playerSearch: [],
                    playerPages: [],
                    pickBuilder: [],
                    discord: [],
                    pro: ["Arbitrage", "Middles", "EV+ board"]
                },
                l = p.default;

            function d(s) {
                return "string" == typeof s && a.has(s)
            }

            function c(s) {
                let t = null == s ? void 0 : s.plan;
                return "string" == typeof t && t.trim() ? t : "None"
            }

            function _(s) {
                return "Admin" === s || "Friend" === s
            }

            function u(s) {
                if ("string" != typeof s || !s) return null;
                let t = new Date(s);
                return Number.isNaN(t.getTime()) ? null : t
            }

            function y(s) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    e = c(s);
                return !!_(e) || !!d(e) && ((null == s ? void 0 : s.tier) === "pro" || function(s, t) {
                    let e = u(null == s ? void 0 : s.proTrialEndsAt);
                    return null !== e && e.getTime() > t
                }(s, t))
            }

            function h(s) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    e = c(s),
                    a = d(e),
                    r = _(e),
                    i = u(null == s ? void 0 : s.proTrialEndsAt),
                    o = null !== i && i.getTime() > t,
                    n = (null == s ? void 0 : s.tier) === "pro",
                    p = y(s, t),
                    l = (null == s ? void 0 : s.proTrialProvider) === "stripe" || (null == s ? void 0 : s.proTrialProvider) === "clerk" ? s.proTrialProvider : null,
                    h = (null == s ? void 0 : s.billingProvider) === "stripe" || (null == s ? void 0 : s.billingProvider) === "revenuecat" || (null == s ? void 0 : s.billingProvider) === "both" || (null == s ? void 0 : s.billingProvider) === "none" ? s.billingProvider : null,
                    m = o ? Math.max(1, Math.ceil((i.getTime() - t) / 864e5)) : 0;
                return {
                    plan: e,
                    tier: p ? "pro" : "premium",
                    hasPaid: a,
                    hasPro: p,
                    isTrial: a && !r && o,
                    trialEndsAt: i,
                    trialDaysLeft: m,
                    isTrialEligible: "User" === c(s) && (null == s ? void 0 : s.tier) !== "pro" && (null == s ? void 0 : s.proTrialUsed) !== !0,
                    trialUsed: (null == s ? void 0 : s.proTrialUsed) === !0,
                    trialProvider: l,
                    trialOptedOut: (null == s ? void 0 : s.proTrialOptedOut) === !0,
                    billingProvider: h,
                    isComped: r || n && !o
                }
            }

            function m(s) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    e = h(s, t);
                return "Friend" === e.plan ? "Friends & Family" : "Admin" === e.plan ? "Admin" : e.hasPaid ? e.isTrial && !e.isComped ? "Pro trial" : e.hasPro ? "Pro" : "Premium" : "None" === e.plan ? "Free" : e.plan
            }
        },
        36839: function(s, t, e) {
            e.d(t, {
                Ad: function() {
                    return c
                },
                BP: function() {
                    return u
                },
                K: function() {
                    return a
                },
                Qu: function() {
                    return i
                },
                T4: function() {
                    return _
                },
                V0: function() {
                    return o
                },
                eh: function() {
                    return d
                },
                g8: function() {
                    return l
                },
                he: function() {
                    return p
                },
                tT: function() {
                    return n
                }
            });
            let a = ["monthly", "quarterly", "yearly"],
                r = {
                    premium: {
                        monthly: "price_1TzpfHHOHI9AQrqLSK6UBrMa",
                        quarterly: "price_1QQ2kfHOHI9AQrqLnn4XMXld",
                        yearly: "price_1QQ2kFHOHI9AQrqLWO8XxYCZ"
                    },
                    pro: {
                        monthly: "price_1UEELEHOHI9AQrqL3oCSOjf1",
                        quarterly: "price_1UEELWHOHI9AQrqLUW8cRfra",
                        yearly: "price_1UEELpHOHI9AQrqLRwrDyMyH"
                    }
                },
                i = {
                    premium: {
                        monthly: {
                            price: 19.99,
                            originalPrice: 24.99
                        },
                        quarterly: {
                            price: 39.99,
                            originalPrice: 49.99
                        },
                        yearly: {
                            price: 149.99,
                            originalPrice: 199.99
                        }
                    },
                    pro: {
                        monthly: {
                            price: 49.99
                        },
                        quarterly: {
                            price: 99.99
                        },
                        yearly: {
                            price: 299.99
                        }
                    }
                },
                o = {
                    monthly: {
                        label: "Monthly",
                        suffix: "/month",
                        shortSuffix: "/mo",
                        metaName: "Monthly",
                        months: 1
                    },
                    quarterly: {
                        label: "Quarterly",
                        suffix: "/3 mo",
                        shortSuffix: "/3 mo",
                        metaName: "Quarterly",
                        months: 3
                    },
                    yearly: {
                        label: "Annual",
                        suffix: "/year",
                        shortSuffix: "/yr",
                        metaName: "Yearly",
                        months: 12
                    }
                };

            function n(s, t) {
                if ("monthly" === t) return 0;
                let e = i[s].monthly.price * o[t].months;
                return Math.max(0, Math.round((1 - i[s][t].price / e) * 100))
            }

            function p(s, t) {
                let e = n(s, t);
                return e > 0 ? "".concat(e, "% off") : null
            }

            function l(s) {
                let t = Math.max(n("premium", s), n("pro", s));
                return t <= 0 ? null : (n("premium", s), n("pro", s), "".concat(t, "% off"))
            }
            let d = {
                    premium: {
                        label: "Premium",
                        tagline: "Everything you need to research props across 14+ sports."
                    },
                    pro: {
                        label: "Pro",
                        tagline: "Everything in Premium plus the cross-book edge tools."
                    }
                },
                c = ["Everything in Premium", "Arbitrage finder across 20+ books", "Middles board with live line windows", "EV+ board with multi-book devig"];

            function _(s) {
                return "$".concat(s.toFixed(2))
            }

            function u(s, t) {
                return r[s][t]
            }
        },
        59160: function(s, t, e) {
            e.d(t, {
                B: function() {
                    return o
                },
                WebViewProvider: function() {
                    return n
                }
            });
            var a = e(10131),
                r = e(55185);
            let i = (0, r.createContext)(void 0),
                o = () => {
                    let s = (0, r.useContext)(i);
                    if (void 0 === s) throw Error("useWebView must be used within a WebViewProvider");
                    return s
                },
                n = s => {
                    let {
                        isWebViewApp: t,
                        children: e
                    } = s, [o, n] = (0, r.useState)(!1);
                    return (0, r.useEffect)(() => {
                        void 0 === t && n(navigator.userAgent.includes("PWAShell"))
                    }, [t]), (0, a.jsx)(i.Provider, {
                        value: {
                            isWebViewApp: null != t ? t : o
                        },
                        children: e
                    })
                }
        },
        93630: function(s, t, e) {
            e.d(t, {
                ZP: function() {
                    return x
                },
                kU: function() {
                    return w
                },
                w$: function() {
                    return H
                },
                M9: function() {
                    return T
                },
                wU: function() {
                    return u
                },
                E6: function() {
                    return B
                },
                U8: function() {
                    return F
                }
            });
            var a = e(62839),
                r = e(62557),
                i = e(41224),
                o = e(28596),
                n = e(10131),
                p = e(63210),
                l = e(40480);
            let d = ["total_points", "team_total", "1st_half_total_points", "1st_half_team_total", "1st_quarter_total_points", "1st_quarter_team_total", "2nd_half_total_points"],
                c = ["total_points", "team_total", "1st_half_total_points", "1st_half_team_total", "1st_quarter_total_points", "2nd_half_total_points", "total_touchdowns"],
                _ = ["total_maps", "total_kills", "total_rounds", "team_total", "1st_map_total_kills", "1st_map_total_rounds", "2nd_map_total_kills", "2nd_map_total_rounds"],
                u = (s, t) => {
                    var e;
                    if (!s) return [];
                    let a = s.supportingStatsByPosition;
                    if (a && t) {
                        let s = Object.keys(a).find(s => s.toLowerCase() === t.trim().toLowerCase());
                        if (s) return a[s]
                    }
                    return null !== (e = s.supportingStats) && void 0 !== e ? e : []
                },
                y = [{
                    display: "Minutes",
                    periodIndices: "all",
                    short: "Min",
                    statKeys: ["minutes"]
                }, {
                    display: "Points",
                    periodIndices: "all",
                    short: "Pts",
                    statKeys: ["points"],
                    marketId: "player_points"
                }, {
                    stacks: [{
                        label: "OReb",
                        key: "offensive_rebounds"
                    }, {
                        label: "DReb",
                        key: "defensive_rebounds"
                    }],
                    display: "Rebounds",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Rebound Chances", "Contested Rebounds", "Deferred Rebound Chances", "Personal Fouls"],
                    short: "Rebs",
                    potentials: ["Rebound Chances", "Contested Rebounds", "Deferred Rebound Chances"],
                    statKeys: ["rebounds"],
                    background: ["Rebound Chances"],
                    marketId: "player_rebounds"
                }, {
                    display: "Offensive Rebounds",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Offensive Rebound Chances", "Rebounds", "Personal Fouls"],
                    short: "O-Reb",
                    potentials: ["Offensive Rebound Chances"],
                    statKeys: ["offensive_rebounds"],
                    background: ["Offensive Rebound Chances"],
                    marketId: "player_offensive_rebounds"
                }, {
                    display: "Defensive Rebounds",
                    supportingStats: ["Minutes", "Defensive Rebound Chances", "Rebounds", "Personal Fouls"],
                    periodIndices: "all",
                    short: "D-Reb",
                    potentials: ["Defensive Rebound Chances"],
                    statKeys: ["defensive_rebounds"],
                    background: ["Defensive Rebound Chances"],
                    marketId: "player_defensive_rebounds"
                }, {
                    display: "Assists",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Potential Assists", "Passes Made"],
                    short: "Asts",
                    potentials: ["Potential Assists", "Passes Made"],
                    statKeys: ["assists"],
                    marketId: "player_assists",
                    background: ["Potential Assists"]
                }, {
                    stacks: [{
                        label: "Pts",
                        key: "points"
                    }, {
                        label: "Ast",
                        key: "assists"
                    }],
                    display: "Pts+Asts",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Points", "Assists", "Passes Made", "FG Made", "3-PT Made", "FT Made", "Personal Fouls"],
                    short: "PA",
                    statKeys: ["points", "assists"],
                    marketId: "player_points_+_assists"
                }, {
                    stacks: [{
                        label: "Pts",
                        key: "points"
                    }, {
                        label: "Reb",
                        key: "rebounds"
                    }],
                    display: "Pts+Rebs",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Points", "Rebounds", "FG Made", "3-PT Made", "FT Made", "Personal Fouls"],
                    short: "PR",
                    statKeys: ["points", "rebounds"],
                    marketId: "player_points_+_rebounds"
                }, {
                    stacks: [{
                        label: "Reb",
                        key: "rebounds"
                    }, {
                        label: "Ast",
                        key: "assists"
                    }],
                    display: "Rebs+Asts",
                    periodIndices: "all",
                    supportingStats: ["Minutes", "Rebounds", "Assists", "Passes Made", "Personal Fouls"],
                    short: "RA",
                    potentials: ["Rebound Chances", "Potential Assists"],
                    statKeys: ["rebounds", "assists"],
                    background: ["Rebound Chances", "Potential Assists"],
                    marketId: "player_rebounds_+_assists"
                }, {
                    stacks: [{
                        label: "Pts",
                        key: "points"
                    }, {
                        label: "Reb",
                        key: "rebounds"
                    }, {
                        label: "Ast",
                        key: "assists"
                    }],
                    display: "Pts+Rebs+Asts",
                    supportingStats: ["Minutes", "Points", "Rebounds", "Assists", "Personal Fouls"],
                    periodIndices: "all",
                    short: "PRA",
                    statKeys: ["points", "rebounds", "assists"],
                    marketId: "player_points_+_rebounds_+_assists"
                }, {
                    display: "Blocks",
                    periodIndices: "all",
                    short: "Blks",
                    statKeys: ["blocks"],
                    marketId: "player_blocks"
                }, {
                    display: "Steals",
                    periodIndices: "all",
                    short: "Stls",
                    statKeys: ["steals"],
                    marketId: "player_steals"
                }, {
                    display: "Turnovers",
                    periodIndices: "all",
                    short: "TO",
                    statKeys: ["turnovers"],
                    marketId: "player_turnovers"
                }, {
                    display: "3-PT Made",
                    periodIndices: "all",
                    short: "3PM",
                    statKeys: ["three_points_made"],
                    background: ["3-PT Attempts"],
                    marketId: "player_made_threes"
                }, {
                    display: "3-PT Attempts",
                    periodIndices: "all",
                    short: "3PA",
                    statKeys: ["three_points_att"],
                    marketId: "player_threes_attempted"
                }, {
                    display: "2-PT Made",
                    periodIndices: "all",
                    short: "2PM",
                    statKeys: ["two_points_made"],
                    background: ["2-PT Attempts"],
                    marketId: "player_made_two_pointers"
                }, {
                    display: "2-PT Attempts",
                    periodIndices: "all",
                    short: "2PA",
                    statKeys: ["two_points_att"],
                    marketId: "player_two_pointers_attempted"
                }, {
                    display: "FT Made",
                    periodIndices: "all",
                    supportingStats: ["FG Attempts", "3-PT Attempts"],
                    short: "FTM",
                    statKeys: ["free_throws_made"],
                    background: ["FT Attempts"],
                    marketId: "player_free_throws_made"
                }, {
                    display: "FT Attempts",
                    periodIndices: "all",
                    short: "FTA",
                    statKeys: ["free_throws_att"],
                    marketId: "player_free_throws_attempted"
                }, {
                    display: "FG Made",
                    periodIndices: "all",
                    short: "FGM",
                    statKeys: ["field_goals_made"],
                    background: ["FG Attempts"],
                    marketId: "player_field_goals_made"
                }, {
                    display: "FG Attempts",
                    periodIndices: "all",
                    short: "FGA",
                    statKeys: ["field_goals_att"],
                    marketId: "player_field_goals_attempted"
                }, {
                    stacks: [{
                        label: "Blk",
                        key: "blocks"
                    }, {
                        label: "Stl",
                        key: "steals"
                    }],
                    display: "Blks+Stls",
                    periodIndices: "all",
                    short: "BS",
                    statKeys: ["blocks", "steals"],
                    marketId: "player_steals_+_blocks"
                }, {
                    display: "Fantasy Score (PP/UD)",
                    periodIndices: "all",
                    short: "FP",
                    supportingStats: ["Minutes", "Points", "Rebounds", "Assists", "Steals", "Blocks", "Personal Fouls"],
                    statKeys: ["fantasy"],
                    marketId: "player_fantasy_score_all_",
                    fantasyScores: [
                        ["points", 1],
                        ["rebounds", 1.2],
                        ["assists", 1.5],
                        ["steals", 3],
                        ["blocks", 3],
                        ["turnovers", -1]
                    ]
                }, {
                    display: "Dunks",
                    periodIndices: "all",
                    short: "DUNK",
                    statKeys: ["dunks_made"],
                    background: ["Dunk Attempts"],
                    supportingStats: ["Dunk Attempts", "FG Attempts"],
                    marketId: "player_dunks"
                }, {
                    display: "Dunk Attempts",
                    periodIndices: "all",
                    short: "DUNK-Att",
                    statKeys: ["dunks_att"]
                }, {
                    display: "Personal Fouls",
                    periodIndices: "all",
                    short: "PF",
                    statKeys: ["personal_fouls"],
                    marketId: "player_fouls"
                }, {
                    display: "Double Double",
                    periodIndices: [0],
                    short: "DBL-DBL",
                    supportingStats: ["Points", "Rebounds", "Assists", "Steals", "Blocks"],
                    postComputed: !0,
                    statKeys: ["double_double"],
                    marketId: "player_double_double"
                }, {
                    display: "Triple Double",
                    periodIndices: [0],
                    short: "TRP-DBL",
                    supportingStats: ["Points", "Rebounds", "Assists", "Steals", "Blocks"],
                    postComputed: !0,
                    statKeys: ["triple_double"],
                    marketId: "player_triple_double"
                }, {
                    display: "Potential Assists",
                    periodIndices: [0],
                    short: "Potential Asts",
                    potential: !0,
                    description: "Pass that led to a shot attempt",
                    statKeys: ["potentialAssist"]
                }, {
                    display: "Rebound Chances",
                    periodIndices: [0],
                    short: "Reb Chances",
                    potential: !0,
                    description: "Rebounds that the player was close to",
                    statKeys: ["rebChances"]
                }, {
                    display: "Offensive Rebound Chances",
                    periodIndices: [0],
                    short: "O-Reb Chances",
                    potential: !0,
                    description: "Offensive rebounds that the player was close to",
                    statKeys: ["oRebChances"]
                }, {
                    display: "Defensive Rebound Chances",
                    periodIndices: [0],
                    short: "D-Reb Chances",
                    potential: !0,
                    description: "Defensive rebounds that the player was close to",
                    statKeys: ["dRebChances"]
                }, {
                    display: "Deferred Rebound Chances",
                    periodIndices: [0],
                    short: "Defer-Reb",
                    potential: !0,
                    description: "Rebounds player gave to teammates",
                    statKeys: ["deferRebChances"]
                }, {
                    display: "Contested Rebounds",
                    periodIndices: [0],
                    short: "Contested Rebs",
                    potential: !0,
                    description: "Rebounds won while contested by an opponent",
                    statKeys: ["contestedReb"]
                }, {
                    display: "Passes Made",
                    periodIndices: [0],
                    description: "Passes made to teammates",
                    short: "Passes",
                    potential: !0,
                    statKeys: ["passesMade"]
                }],
                h = y.filter(s => !s.potential && "Dunks" !== s.display),
                m = [{
                    label: "1st",
                    index: 0
                }, {
                    label: "2nd",
                    index: 1
                }, {
                    label: "3rd",
                    index: 2
                }, {
                    label: "4th",
                    index: 3
                }],
                g = [{
                    label: "1st",
                    order: 1,
                    index: [0, 1]
                }, {
                    label: "2nd",
                    order: 2,
                    index: [2, 3]
                }],
                k = new Set(h.filter(s => !s.postComputed).map(s => s.display)),
                I = new Set(y.filter(s => !s.potential && !s.postComputed).map(s => s.display));

            function f(s, t, e) {
                return (null == s ? void 0 : s.length) ? s.map(s => e.has(s) ? "".concat(t).concat(s) : s) : s
            }
            let S = h.filter(s => !s.postComputed).flatMap(s => {
                    let t = [];
                    for (let {
                            index: e,
                            label: a
                        } of m) {
                        let r = [e],
                            i = "".concat(e + 1, "Q ");
                        t.push({ ...s,
                            display: "".concat(i).concat(s.display),
                            short: "".concat(e + 1, "Q ").concat(s.short),
                            marketId: "".concat(a, "_quarter_").concat(s.marketId),
                            periodIndices: r,
                            background: f(s.background, i, k),
                            includeLive: "4th" === a
                        })
                    }
                    for (let {
                            index: e,
                            label: a,
                            order: r
                        } of g) {
                        let i = "".concat(r, "H ");
                        t.push({ ...s,
                            display: "".concat(i).concat(s.display),
                            short: "".concat(r, "H ").concat(s.short),
                            marketId: "".concat(a, "_half_").concat(s.marketId),
                            periodIndices: e,
                            background: f(s.background, i, k),
                            includeLive: "2nd" === a
                        })
                    }
                    return t
                }),
                b = y.filter(s => !s.potential && !s.postComputed).flatMap(s => {
                    let t = [];
                    for (let {
                            index: e,
                            label: a
                        } of m) {
                        let r = [e],
                            i = "".concat(e + 1, "Q ");
                        t.push({ ...s,
                            display: "".concat(i).concat(s.display),
                            short: "".concat(e + 1, "Q ").concat(s.short),
                            marketId: "".concat(a, "_quarter_").concat(s.marketId),
                            periodIndices: r,
                            background: f(s.background, i, I),
                            includeLive: "4th" === a
                        })
                    }
                    for (let {
                            index: e,
                            label: a,
                            order: r
                        } of g) {
                        let i = "".concat(r, "H ");
                        t.push({ ...s,
                            display: "".concat(i).concat(s.display),
                            short: "".concat(r, "H ").concat(s.short),
                            marketId: "".concat(a, "_half_").concat(s.marketId),
                            periodIndices: e,
                            background: f(s.background, i, I),
                            includeLive: "2nd" === a
                        })
                    }
                    return t
                }),
                M = [{
                    label: "1st",
                    index: 0
                }, {
                    label: "2nd",
                    index: 1
                }, {
                    label: "3rd",
                    index: 2
                }],
                P = [{
                    display: "Time On Ice",
                    short: "TOI",
                    periodIndices: [0],
                    postComputed: !0,
                    marketId: "player_time_on_ice",
                    statKeys: ["toi"],
                    positions: ["D", "RW", "LW", "C", "G"]
                }, {
                    display: "Points",
                    short: "Pts",
                    periodIndices: "all",
                    marketId: "player_points",
                    supportingStats: ["Time On Ice", "Goals", "Assists", "Shots on Goal"],
                    statKeys: ["points"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Goals",
                    short: "Goals",
                    periodIndices: "all",
                    marketId: "player_goals",
                    supportingStats: ["Time On Ice", "Assists", "Shots on Goal"],
                    statKeys: ["goals"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Assists",
                    short: "Asts",
                    periodIndices: "all",
                    marketId: "player_assists",
                    supportingStats: ["Time On Ice", "Goals", "Shots on Goal"],
                    statKeys: ["assists"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Shots on Goal",
                    short: "SOG",
                    periodIndices: "all",
                    marketId: "player_shots_on_goal",
                    supportingStats: ["Time On Ice", "Goals", "Assists", "Shots"],
                    statKeys: ["shots_on_goal"],
                    positions: ["D", "RW", "LW", "C"],
                    background: ["Shots"]
                }, {
                    display: "Shots",
                    short: "Shots",
                    periodIndices: "all",
                    marketId: "player_shots",
                    supportingStats: ["Time On Ice", "Assists", "Shots on Goal"],
                    statKeys: ["shots"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Hits",
                    short: "Hit",
                    periodIndices: "all",
                    marketId: "player_hits",
                    supportingStats: ["Time On Ice"],
                    statKeys: ["hits"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Faceoffs Won",
                    short: "FOW",
                    periodIndices: "all",
                    marketId: "player_faceoffs_won",
                    supportingStats: ["Time On Ice"],
                    statKeys: ["faceoffs_won"],
                    positions: ["D", "RW", "LW", "C"],
                    background: ["Faceoffs Lost"],
                    dontSubtractBg: !0
                }, {
                    display: "Faceoffs Lost",
                    short: "FOL",
                    periodIndices: "all",
                    supportingStats: ["Time On Ice"],
                    statKeys: ["faceoffs_lost"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Blocked Shots",
                    short: "BS",
                    periodIndices: "all",
                    marketId: "player_blocked_shots",
                    supportingStats: ["Time On Ice"],
                    statKeys: ["blocked_shots"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Power Play Points",
                    short: "PPP",
                    periodIndices: "all",
                    marketId: "player_power_play_points",
                    supportingStats: ["Time On Ice", "Goals", "Assists", "Shots"],
                    statKeys: ["power_play_points"],
                    positions: ["D", "RW", "LW", "C"]
                }, {
                    display: "Fantasy Score",
                    short: "FP",
                    periodIndices: "all",
                    supportingStats: ["Goals", "Assists", "Shots", "Power Play Points", "Blocked Shots", "Hits"],
                    statKeys: ["fantasy"],
                    positions: ["D", "RW", "LW", "C"],
                    marketId: "player_fantasy_score_underdog_",
                    fantasyScores: [
                        ["goals", 6],
                        ["assists", 4],
                        ["power_play_points", .5],
                        ["shots_on_goal", 1],
                        ["blocked_shots", 1],
                        ["hits", .5]
                    ]
                }, {
                    display: "Goalie Saves",
                    short: "Save",
                    periodIndices: "all",
                    marketId: "player_saves",
                    supportingStats: ["Time On Ice", "Shots Against", "Goals Allowed"],
                    statKeys: ["saves"],
                    positions: ["G"],
                    background: ["Shots Against"]
                }, {
                    display: "Goals Allowed",
                    short: "GA",
                    periodIndices: "all",
                    marketId: "player_goals_against",
                    supportingStats: ["Time On Ice", "Shots Against", "Goalie Saves"],
                    statKeys: ["goals_against"],
                    positions: ["G"],
                    background: ["Shots Faced"]
                }, {
                    display: "Shots Faced",
                    short: "Shots-Faced",
                    periodIndices: "all",
                    supportingStats: ["Time On Ice", "Goalie Saves", "Goals Allowed"],
                    statKeys: ["shots_against"],
                    positions: ["G"]
                }],
                K = new Set(P.filter(s => !s.postComputed).map(s => s.display)),
                R = P.filter(s => !s.postComputed).flatMap(s => M.map(t => {
                    let {
                        label: e,
                        index: a
                    } = t, r = "".concat(a + 1, "P ");
                    return { ...s,
                        display: "".concat(r).concat(s.display),
                        short: "".concat(a + 1, "P ").concat(s.short),
                        marketId: "".concat(e, "_period_").concat(s.marketId),
                        periodIndices: [a],
                        background: f(s.background, r, K),
                        includeLive: "3rd" === e || "2nd" === e
                    }
                })),
                v = [{
                    display: "Pass Yards",
                    short: "Pass Yds",
                    statKeys: ["passing_yards"],
                    marketId: "player_passing_yards",
                    supportingStats: ["Pass Completions", "Pass Attempts", "Pass TDs", "Longest Completion"],
                    positions: ["QB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Pass TDs",
                    short: "Pass TD",
                    statKeys: ["passing_touchdowns"],
                    marketId: "player_passing_touchdowns",
                    supportingStats: ["Pass Completions", "Pass Attempts", "Pass Yards"],
                    positions: ["QB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Pass Attempts",
                    short: "Pass Att",
                    statKeys: ["passing_attempts"],
                    marketId: "player_passing_attempts",
                    supportingStats: ["Pass Completions", "Pass Yards", "Pass TDs"],
                    positions: ["QB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Pass Completions",
                    short: "Pass Comp",
                    statKeys: ["passing_completions"],
                    marketId: "player_passing_completions",
                    background: ["Pass Attempts"],
                    supportingStats: ["Pass Attempts", "Pass Yards", "Pass TDs"],
                    positions: ["QB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Interceptions",
                    short: "Int",
                    statKeys: ["passing_interceptions"],
                    marketId: "player_interceptions",
                    supportingStats: ["Pass Attempts", "Pass Completions", "Pass Yards"],
                    positions: ["QB"],
                    periodIndices: "all"
                }, {
                    display: "Rush Yards",
                    short: "Rush Yds",
                    statKeys: ["rushing_yards"],
                    marketId: "player_rushing_yards",
                    supportingStats: ["Rush Attempts", "Longest Rush", "Rush TDs"],
                    supportingStatsByPosition: {
                        RB: ["Rush Attempts", "Longest Rush", "Receptions", "Rec Yards"],
                        FB: ["Rush Attempts", "Longest Rush", "Receptions", "Rec Yards"]
                    },
                    positions: ["QB", "RB", "FB", "WR", "TE"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Rush Attempts",
                    short: "Rush Att",
                    statKeys: ["rushing_attempts"],
                    marketId: "player_rushing_attempts",
                    supportingStats: ["Rush Yards", "Rush TDs", "Longest Rush"],
                    positions: ["QB", "RB", "FB", "WR"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Rush TDs",
                    short: "Rush TD",
                    statKeys: ["rushing_touchdowns"],
                    marketId: "player_rushing_touchdowns",
                    supportingStats: ["Rush Attempts", "Rush Yards", "Rush+Rec TDs"],
                    positions: ["RB", "QB", "WR", "TE", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Receptions",
                    short: "Recs",
                    statKeys: ["receiving_receptions"],
                    marketId: "player_receptions",
                    background: ["Rec Targets"],
                    supportingStats: ["Rec Targets", "Rec Yards", "Receiving TDs"],
                    positions: ["WR", "RB", "TE", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Rec Yards",
                    short: "Rec Yds",
                    statKeys: ["receiving_yards"],
                    marketId: "player_receiving_yards",
                    supportingStats: ["Receptions", "Rec Targets", "Longest Reception", "Receiving TDs"],
                    positions: ["WR", "TE", "RB", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Rec Targets",
                    short: "TGTs",
                    statKeys: ["receiving_targets"],
                    marketId: "player_receiving_targets",
                    supportingStats: ["Receptions", "Rec Yards", "Redzone Targets"],
                    positions: ["WR", "TE", "RB", "FB"],
                    periodIndices: "all"
                }, {
                    display: "Redzone Targets",
                    short: "RZ Tgt",
                    statKeys: ["receiving_redzone_targets"],
                    supportingStats: ["Rec Targets", "Receptions"],
                    positions: ["WR", "TE", "RB", "FB"],
                    periodIndices: "all"
                }, {
                    display: "Receiving TDs",
                    short: "Rec TD",
                    statKeys: ["receiving_touchdowns"],
                    marketId: "player_receiving_touchdowns",
                    supportingStats: ["Redzone Targets", "Rec Targets", "Receptions", "Rec Yards"],
                    positions: ["RB", "WR", "TE", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    stacks: [{
                        label: "Rush",
                        key: "rushing_touchdowns"
                    }, {
                        label: "Rec",
                        key: "receiving_touchdowns"
                    }],
                    display: "Rush+Rec TDs",
                    short: "R+R TD",
                    statKeys: ["rushing_touchdowns", "receiving_touchdowns"],
                    marketId: "player_touchdowns",
                    supportingStats: ["Redzone Targets", "Rush Attempts", "Rec Targets", "Rush Yards", "Rec Yards"],
                    positions: ["RB", "QB", "WR", "TE", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    stacks: [{
                        label: "Rush",
                        key: "rushing_yards"
                    }, {
                        label: "Rec",
                        key: "receiving_yards"
                    }],
                    display: "Rush + Rec Yds",
                    short: "R+R Yds",
                    statKeys: ["rushing_yards", "receiving_yards"],
                    marketId: "player_rushing_+_receiving_yards",
                    supportingStats: ["Rush Attempts", "Rec Targets", "Rush Yards", "Rec Yards"],
                    positions: ["RB", "WR", "TE", "FB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    stacks: [{
                        label: "Pass",
                        key: "passing_yards"
                    }, {
                        label: "Rush",
                        key: "rushing_yards"
                    }],
                    display: "Pass + Rush Yds",
                    short: "P+R Yds",
                    statKeys: ["passing_yards", "rushing_yards"],
                    marketId: "player_passing_+_rushing_yards",
                    supportingStats: ["Pass Attempts", "Rush Attempts", "Pass Yards", "Rush Yards"],
                    positions: ["QB"],
                    periodIndices: "all",
                    hasPeriods: !0
                }, {
                    display: "Longest Rush",
                    short: "Long Rush",
                    statKeys: ["rushing_longest"],
                    marketId: "player_longest_rush",
                    supportingStats: ["Rush Attempts", "Rush Yards"],
                    positions: ["QB", "RB", "WR", "TE", "FB"],
                    periodIndices: [0],
                    postComputed: !0
                }, {
                    display: "Longest Reception",
                    short: "Long Rec",
                    statKeys: ["receiving_longest"],
                    marketId: "player_longest_reception",
                    supportingStats: ["Receptions", "Rec Targets", "Rec Yards"],
                    positions: ["RB", "WR", "TE", "FB"],
                    periodIndices: [0],
                    postComputed: !0
                }, {
                    display: "Longest Completion",
                    short: "Long Comp",
                    statKeys: ["passing_longest"],
                    marketId: "player_longest_passing_completion",
                    supportingStats: ["Pass Completions", "Pass Attempts", "Pass Yards"],
                    positions: ["QB"],
                    periodIndices: [0],
                    postComputed: !0
                }, {
                    display: "Completion %",
                    short: "Cmp%",
                    statKeys: ["passing_completion_percentage"],
                    marketId: "player_passing_completion_percentage",
                    supportingStats: ["Pass Completions", "Pass Attempts", "Pass Yards"],
                    positions: ["QB"],
                    periodIndices: [0],
                    postComputed: !0
                }, {
                    display: "Sacks Taken",
                    short: "Sacked",
                    statKeys: ["passing_sacks"],
                    marketId: "player_sacks_taken",
                    supportingStats: ["Pass Attempts", "Pass Yards", "Pass TDs"],
                    positions: ["QB"],
                    periodIndices: "all"
                }, {
                    display: "Sacks",
                    short: "Sacks",
                    statKeys: ["defense_sacks"],
                    marketId: "player_sacks",
                    supportingStats: ["Tackles", "Tackles + Assists"],
                    positions: ["LB", "DE", "DT", "DL"],
                    periodIndices: "all"
                }, {
                    display: "Tackles",
                    short: "Tack",
                    statKeys: ["defense_tackles"],
                    marketId: "player_tackles",
                    supportingStats: ["Tackles + Assists", "Assists", "Sacks"],
                    positions: ["LB", "DE", "DT", "DL", "CB", "S", "DB"],
                    periodIndices: "all"
                }, {
                    display: "Assists",
                    short: "Ast",
                    statKeys: ["defense_assist_tackles"],
                    marketId: "player_assists",
                    supportingStats: ["Tackles", "Tackles + Assists"],
                    positions: ["LB", "DE", "DT", "DL", "CB", "S", "DB"],
                    periodIndices: "all"
                }, {
                    stacks: [{
                        label: "Tack",
                        key: "defense_tackles"
                    }, {
                        label: "Ast",
                        key: "defense_assist_tackles"
                    }],
                    display: "Tackles + Assists",
                    short: "Tac+Ast",
                    statKeys: ["defense_tackles", "defense_assist_tackles"],
                    marketId: "player_tackles_+_assists",
                    supportingStats: ["Tackles", "Assists", "Sacks"],
                    positions: ["LB", "DE", "DT", "DL", "CB", "S", "DB"],
                    periodIndices: "all"
                }, {
                    display: "FG Made",
                    short: "FGs",
                    statKeys: ["kicking_fg_made"],
                    marketId: "player_field_goals_made",
                    supportingStats: ["Extra Points", "Kicking Points"],
                    positions: ["K", "PK", "K/P"],
                    periodIndices: "all"
                }, {
                    display: "Extra Points",
                    short: "XP",
                    statKeys: ["kicking_xp_made"],
                    marketId: "player_extra_points_made",
                    supportingStats: ["FG Made", "Kicking Points"],
                    positions: ["K", "PK", "K/P"],
                    periodIndices: "all"
                }, {
                    fantasyScores: [
                        ["kicking_fg_made", 3],
                        ["kicking_xp_made", 1]
                    ],
                    display: "Kicking Points",
                    short: "KPts",
                    statKeys: ["kicking_fg_made", "kicking_xp_made"],
                    marketId: "player_kicking_points",
                    supportingStats: ["FG Made", "Extra Points"],
                    positions: ["K", "PK", "K/P"],
                    periodIndices: "all"
                }, {
                    display: "Punts",
                    short: "Punts",
                    statKeys: ["punting_attempts"],
                    marketId: "player_punts",
                    supportingStats: ["Punts Inside 20"],
                    positions: ["P", "K/P"],
                    periodIndices: "all"
                }, {
                    display: "Punts Inside 20",
                    short: "IN20",
                    statKeys: ["punting_inside_20"],
                    supportingStats: ["Punts"],
                    positions: ["P", "K/P"],
                    periodIndices: "all"
                }, {
                    display: "Fumbles Lost",
                    short: "Fumb",
                    statKeys: ["fumbles_lost"],
                    supportingStats: ["Rush Attempts", "Receptions"],
                    positions: ["QB", "RB", "WR", "TE", "FB"],
                    periodIndices: "all"
                }, {
                    display: "Fantasy Score",
                    short: "FS",
                    marketId: "player_fantasy_score_prizepicks_",
                    supportingStats: ["Rec Yards", "Rush Yards", "Receptions", "Pass Yards"],
                    supportingStatsByPosition: {
                        QB: ["Pass Yards", "Pass TDs", "Pass Attempts", "Interceptions", "Rush Yards"],
                        RB: ["Rush Yards", "Rush Attempts", "Receptions", "Rec Yards", "Rush TDs"],
                        FB: ["Rush Yards", "Rush Attempts", "Receptions", "Rec Yards"],
                        WR: ["Rec Yards", "Receptions", "Rec Targets", "Receiving TDs", "Rush Yards"],
                        TE: ["Rec Yards", "Receptions", "Rec Targets", "Receiving TDs"]
                    },
                    fantasyScores: [
                        ["passing_yards", .04],
                        ["passing_touchdowns", 4],
                        ["passing_interceptions", -1],
                        ["rushing_yards", .1],
                        ["rushing_touchdowns", 6],
                        ["receiving_yards", .1],
                        ["receiving_touchdowns", 6],
                        ["receiving_receptions", 1],
                        ["fumbles_lost", -1],
                        ["two_point_conversions", 2],
                        ["fumble_recovery_touchdowns", 6],
                        ["kick_return_touchdowns", 6],
                        ["punt_return_touchdowns", 6]
                    ],
                    statKeys: ["passing_yards", "passing_touchdowns", "passing_interceptions", "rushing_yards", "rushing_touchdowns", "receiving_yards", "receiving_touchdowns", "receiving_receptions", "fumbles_lost", "two_point_conversions", "fumble_recovery_touchdowns", "kick_return_touchdowns", "punt_return_touchdowns"],
                    positions: ["QB", "RB", "FB", "WR", "TE"],
                    periodIndices: "all"
                }, {
                    display: "Kicker Fantasy Score",
                    short: "K FS",
                    marketId: "player_fantasy_score_prizepicks_",
                    supportingStats: ["FG Made", "Extra Points", "Kicking Points"],
                    fantasyScores: [
                        ["kicking_fg_made_0_39", 3],
                        ["kicking_fg_made_40_49", 4],
                        ["kicking_fg_made_50_plus", 5],
                        ["kicking_xp_made", 1],
                        ["kicking_fg_missed", -1],
                        ["kicking_xp_missed", -1]
                    ],
                    statKeys: ["kicking_fg_made_0_39", "kicking_fg_made_40_49", "kicking_fg_made_50_plus", "kicking_xp_made", "kicking_fg_missed", "kicking_xp_missed"],
                    positions: ["K", "PK", "K/P"],
                    periodIndices: "all"
                }],
                D = new Set(v.filter(s => s.hasPeriods).map(s => s.display)),
                A = v.filter(s => s.hasPeriods && s.marketId).flatMap(s => {
                    let t = [];
                    for (let {
                            label: e,
                            index: a
                        } of m) {
                        let r = "".concat(a + 1, "Q ");
                        t.push({ ...s,
                            display: "".concat(r).concat(s.display),
                            short: "".concat(a + 1, "Q ").concat(s.short),
                            marketId: "".concat(e, "_quarter_").concat(s.marketId),
                            periodIndices: [a],
                            background: f(s.background, r, D),
                            includeLive: "4th" === e
                        })
                    }
                    for (let {
                            label: e,
                            order: a,
                            index: r
                        } of g) {
                        let i = "".concat(a, "H ");
                        t.push({ ...s,
                            display: "".concat(i).concat(s.display),
                            short: "".concat(a, "H ").concat(s.short),
                            marketId: "".concat(e, "_half_").concat(s.marketId),
                            periodIndices: r,
                            background: f(s.background, i, D),
                            includeLive: "2nd" === e
                        })
                    }
                    return t
                }),
                F = new Set(["nba", "wnba", "cbb", "nfl", "cfb", "mlb", "nhl", "soccer", "lol", "cs2", "dota2", "val", "cod"]),
                B = new Set(["nba", "wnba", "cbb", "nfl", "cfb", "mlb", "nhl"]),
                w = new Set(["tennis", "soccer"]),
                T = new Set([]),
                H = ["prizepicks", "underdog", "fliff", "sleeper", "dabble", "parlayplay", "dkpick6", "draftkings", "fanduel", "pinnacle", "bovada", "betmgm", "caesars", "bet365", "rebet", "fanatics", "betonlineag", "betrivers", "hardrockbet", "betr", "prophetx", "novig", "courtside", "kalshi", "polymarket", "robinhood"];
            var x = {
                nba: {
                    builderMarkets: d,
                    icon: a.ORR,
                    color: "blue",
                    srBasePath: "/nba/production/v8/en",
                    supportingStats: ["Minutes", "Personal Fouls", "FG Made", "3-PT Made", "FT Made"],
                    statMap: [...y, ...b]
                },
                wnba: {
                    builderMarkets: d,
                    icon: a.ORR,
                    srBasePath: "/wnba/production/v8/en",
                    supportingStats: ["Minutes", "Personal Fouls", "FG Made", "3-PT Made", "FT Made"],
                    color: "fuchsia",
                    statMap: [...h, ...S]
                },
                mlb: {
                    builderMarkets: ["total_runs", "team_total", "1st_half_total_runs", "1st_half_team_total", "1st_inning_total_runs", "total_hits", "total_home_runs"],
                    icon: a.tDb,
                    color: "rose",
                    srBasePath: "/mlb/production/v8/en",
                    statMap: [{
                        display: "Plate Appearances",
                        short: "PA",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        statKeys: ["batter_pa"],
                        marketId: "player_plate_appearances"
                    }, {
                        display: "Hits",
                        short: "Hits",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        statKeys: ["batter_hits"],
                        supportingStats: ["Plate Appearances", "Batter Walks"],
                        marketId: "player_hits"
                    }, {
                        display: "Runs",
                        short: "Runs",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks", "RBIs"],
                        statKeys: ["batter_runs"],
                        marketId: "player_runs"
                    }, {
                        display: "RBIs",
                        short: "RBIs",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Home Runs", "Runs"],
                        statKeys: ["batter_rbis"],
                        marketId: "player_rbis"
                    }, {
                        display: "Hits+Runs+RBIs",
                        short: "H+R+RBI",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Runs", "RBIs", "Batter Walks"],
                        statKeys: ["batter_hits", "batter_runs", "batter_rbis"],
                        stacks: [{
                            label: "Hits",
                            key: "batter_hits"
                        }, {
                            label: "Runs",
                            key: "batter_runs"
                        }, {
                            label: "RBIs",
                            key: "batter_rbis"
                        }],
                        marketId: "player_hits_+_runs_+_rbis"
                    }, {
                        display: "Singles",
                        short: "1B",
                        positions: ["LF", "OF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Total Bases"],
                        statKeys: ["batter_singles"],
                        marketId: "player_singles"
                    }, {
                        display: "Doubles",
                        short: "2B",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Total Bases", "RBIs"],
                        statKeys: ["batter_doubles"],
                        marketId: "player_doubles"
                    }, {
                        display: "Triples",
                        short: "3B",
                        positions: ["LF", "OF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Total Bases", "Runs"],
                        statKeys: ["batter_triples"],
                        marketId: "player_triples"
                    }, {
                        display: "Home Runs",
                        short: "HR",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Total Bases", "RBIs", "Runs"],
                        statKeys: ["batter_home_runs"],
                        marketId: "player_home_runs"
                    }, {
                        display: "Total Bases",
                        short: "Bases",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Home Runs", "RBIs"],
                        statKeys: ["batter_total_bases"],
                        marketId: "player_bases"
                    }, {
                        display: "Stolen Bases",
                        short: "Steals",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks"],
                        statKeys: ["batter_stolen_bases"],
                        marketId: "player_stolen_bases"
                    }, {
                        display: "Caught Stealing",
                        short: "CAUGHT",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks"],
                        statKeys: ["batter_caught_stealing"]
                    }, {
                        display: "Batter Walks",
                        short: "BB",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks"],
                        statKeys: ["batter_walks"],
                        marketId: "player_batting_walks"
                    }, {
                        display: "Hitter Strikeouts",
                        short: "Hit SO",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks"],
                        statKeys: ["batter_strikeouts"],
                        marketId: "player_batting_strikeouts"
                    }, {
                        display: "Hit By Pitch",
                        short: "HBP",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        statKeys: ["batter_hbp"]
                    }, {
                        display: "Pitches Seen",
                        short: "P Seen",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Hits", "Batter Walks"],
                        statKeys: ["batter_pitches_seen"],
                        marketId: "player_pitches_faced"
                    }, {
                        display: "Strikes Counted",
                        short: "Strikes",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Pitches Seen", "Hitter Strikeouts"],
                        statKeys: ["batter_strikes_counted"]
                    }, {
                        display: "1st Inning Pitches Seen",
                        short: "1st P Seen",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["Plate Appearances", "Pitches Seen"],
                        statKeys: ["batter_1st_inning_pitches_seen"],
                        marketId: "1st_inning_player_pitches_faced"
                    }, {
                        display: "1st Inning Strikes Counted",
                        short: "1st Strikes",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        supportingStats: ["1st Inning Pitches Seen", "Strikes Counted"],
                        statKeys: ["batter_1st_inning_strikes_counted"],
                        marketId: "1st_inning_player_batting_strikes"
                    }, {
                        display: "Hitter Fantasy Score (PP)",
                        short: "FP (PP)",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        statKeys: [""],
                        fantasyScores: [
                            ["batter_singles", 3],
                            ["batter_doubles", 5],
                            ["batter_triples", 8],
                            ["batter_home_runs", 10],
                            ["batter_runs", 2],
                            ["batter_rbis", 2],
                            ["batter_walks", 2],
                            ["batter_hbp", 2],
                            ["batter_stolen_bases", 5]
                        ],
                        supportingStats: ["Plate Appearances", "Hits", "Singles", "Doubles", "Triples", "Home Runs", "Runs", "RBIs", "Batter Walks", "Hit By Pitch", "Stolen Bases", "Total Bases"],
                        marketId: "player_batting_fantasy_score_prizepicks_"
                    }, {
                        display: "Hitter Fantasy Score (UD)",
                        short: "FP (UD)",
                        positions: ["LF", "CF", "RF", "1B", "2B", "3B", "SS", "C", "DH", "OF", "DH/P"],
                        statKeys: [""],
                        fantasyScores: [
                            ["batter_singles", 3],
                            ["batter_doubles", 6],
                            ["batter_triples", 8],
                            ["batter_home_runs", 10],
                            ["batter_runs", 2],
                            ["batter_rbis", 2],
                            ["batter_walks", 3],
                            ["batter_hbp", 3],
                            ["batter_stolen_bases", 4]
                        ],
                        supportingStats: ["Plate Appearances", "Hits", "Singles", "Doubles", "Triples", "Home Runs", "Runs", "RBIs", "Batter Walks", "Hit By Pitch", "Stolen Bases", "Total Bases"],
                        marketId: "player_batting_fantasy_score_underdog_"
                    }, {
                        display: "Innings Pitched",
                        short: "IP",
                        positions: ["RP", "SP", "DH/P"],
                        supportingStats: ["Pitching Outs", "Total Pitches"],
                        statKeys: ["pitcher_ip"],
                        pitching: !0
                    }, {
                        display: "Total Pitches",
                        short: "PITCHES",
                        positions: ["RP", "SP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Pitcher Strikeouts", "Walks Allowed"],
                        statKeys: ["pitcher_total_pitches"],
                        marketId: "player_pitches_thrown",
                        pitching: !0
                    }, {
                        display: "Pitcher Strikeouts",
                        short: "K'S",
                        positions: ["SP", "RP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Total Pitches"],
                        statKeys: ["pitcher_strikeouts"],
                        marketId: "player_strikeouts",
                        pitching: !0
                    }, {
                        display: "Hits Allowed",
                        short: "HA",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_hits_allowed"],
                        supportingStats: ["Innings Pitched", "Earned Runs Allowed"],
                        marketId: "player_hits_allowed",
                        pitching: !0
                    }, {
                        display: "Walks Allowed",
                        short: "P-Walks",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_walks_allowed"],
                        supportingStats: ["Innings Pitched", "Hits Allowed"],
                        marketId: "player_walks",
                        pitching: !0
                    }, {
                        display: "Earned Runs Allowed",
                        short: "ER",
                        positions: ["RP", "SP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Hits Allowed", "Walks Allowed"],
                        statKeys: ["pitcher_earned_runs_allowed"],
                        marketId: "player_earned_runs",
                        pitching: !0
                    }, {
                        display: "Pitching Outs",
                        short: "PO",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_outs"],
                        supportingStats: ["Innings Pitched", "Total Pitches"],
                        marketId: "player_outs",
                        pitching: !0
                    }, {
                        display: "Pitcher Fantasy Score (PP)",
                        short: "FP (PP)",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: [""],
                        fantasyScores: [
                            ["pitcher_win", 6],
                            ["pitcher_qstart", 4],
                            ["pitcher_strikeouts", 3],
                            ["pitcher_earned_runs_allowed", -3],
                            ["pitcher_outs", 1]
                        ],
                        supportingStats: ["Innings Pitched", "Pitcher Wins", "Quality Starts", "Pitcher Strikeouts", "Earned Runs Allowed", "Pitching Outs"],
                        marketId: "player_pitching_fantasy_score_prizepicks_",
                        pitching: !0
                    }, {
                        display: "Pitcher Fantasy Score (UD)",
                        short: "FP (UD)",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: [""],
                        fantasyScores: [
                            ["pitcher_win", 5],
                            ["pitcher_qstart", 5],
                            ["pitcher_strikeouts", 3],
                            ["pitcher_earned_runs_allowed", -3],
                            ["pitcher_ip", 3]
                        ],
                        supportingStats: ["Innings Pitched", "Pitcher Wins", "Quality Starts", "Pitcher Strikeouts", "Earned Runs Allowed", "Pitching Outs"],
                        marketId: "player_pitching_fantasy_score_underdog_",
                        pitching: !0
                    }, {
                        display: "No Run First Inning",
                        short: "NRFI",
                        positions: ["SP", "RP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Hits Allowed", "Walks Allowed"],
                        statKeys: ["pitcher_nrfi"],
                        pitching: !0
                    }, {
                        display: "1st Inning Pitches",
                        short: "1st IP",
                        positions: ["RP", "SP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Pitcher Strikeouts", "Walks Allowed"],
                        statKeys: ["pitcher_1st_inning_pitches"],
                        marketId: "1st_inning_player_pitches_thrown",
                        pitching: !0
                    }, {
                        display: "1st Inning Pitcher Strikeouts",
                        short: "1st K'S",
                        positions: ["SP", "RP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Total Pitches"],
                        statKeys: ["pitcher_1st_inning_strikeouts"],
                        marketId: "1st_inning_player_strikeouts",
                        pitching: !0
                    }, {
                        display: "1st Inning Hits Allowed",
                        short: "1st HA",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_1st_inning_hits_allowed"],
                        supportingStats: ["Innings Pitched", "Earned Runs Allowed"],
                        marketId: "1st_inning_player_hits_allowed",
                        pitching: !0
                    }, {
                        display: "Batters Faced",
                        short: "BF",
                        positions: ["SP", "RP", "DH/P"],
                        supportingStats: ["Innings Pitched", "Total Pitches", "Hits Allowed", "Walks Allowed"],
                        statKeys: ["pitcher_batters_faced"],
                        marketId: "player_batters_faced",
                        pitching: !0
                    }, {
                        display: "1st Inning Batters Faced",
                        short: "1st BF",
                        positions: ["SP", "RP", "DH/P"],
                        supportingStats: ["1st Inning Pitches", "1st Inning Hits Allowed"],
                        statKeys: ["pitcher_1st_inning_batters_faced"],
                        marketId: "1st_inning_player_batters_faced",
                        pitching: !0
                    }, {
                        display: "Pitcher Wins",
                        short: "Wins",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_win"],
                        pitching: !0
                    }, {
                        display: "Quality Starts",
                        short: "QS",
                        positions: ["RP", "SP", "DH/P"],
                        statKeys: ["pitcher_qstart"],
                        pitching: !0
                    }]
                },
                cbb: {
                    builderMarkets: d,
                    icon: a.ORR,
                    srBasePath: "/ncaamb/production/v8/en",
                    leagues: ["ncaab"],
                    supportingStats: ["Minutes", "Personal Fouls", "FG Made", "3-PT Made", "FT Made"],
                    color: "red",
                    statMap: [...h, ...S]
                },
                nfl: {
                    builderMarkets: c,
                    icon: r.ANF,
                    color: "green",
                    srBasePath: "/nfl/official/production/v7/en",
                    statMap: [...v, ...A]
                },
                cfb: {
                    builderMarkets: c,
                    icon: r.ANF,
                    color: "green",
                    srBasePath: "/ncaafb/production/v7/en",
                    leagues: ["ncaaf"],
                    statMap: [...v, ...A]
                },
                tennis: {
                    builderMarkets: ["total_games", "total_sets", "1st_set_total_games"],
                    color: "yellow",
                    icon: l.s14,
                    srBasePath: "/tennis/production/v3/en",
                    leagues: ["atp", "atp_challenger", "six_kings_slam", "wta"],
                    supportingStats: ["Aces", "Double Faults", "1st Serve Percentage", "2nd Serve Percentage", "Break Points Saved", "Break Points Won"],
                    statMap: [{
                        display: "Total Games",
                        short: "Games",
                        statKeys: ["total_games"],
                        marketId: "total_games"
                    }, {
                        display: "Games Won",
                        supportingStats: ["Total Games", "Sets Won"],
                        short: "Games Won",
                        statKeys: ["games_won"],
                        marketId: "player_games_won"
                    }, {
                        display: "Games Lost",
                        supportingStats: ["Total Games", "Sets Won"],
                        short: "Games Lost",
                        statKeys: ["games_lost"],
                        marketId: "player_games_lost"
                    }, {
                        display: "Fantasy Score",
                        supportingStats: ["Aces", "Double Faults", "Break Points Won", "Break Points Saved"],
                        short: "FP",
                        statKeys: ["fantasy"],
                        fantasyScores: [
                            ["played_match", 10],
                            ["aces", .5],
                            ["double_faults", -.5],
                            ["games_won", 1],
                            ["sets_won", 3],
                            ["games_lost", -1],
                            ["sets_lost", -3]
                        ],
                        marketId: "player_fantasy_score_prizepicks_"
                    }, {
                        display: "Break Points Won",
                        supportingStats: ["BP Win Percentage", "1st Return Points Won", "2nd Return Points Won"],
                        short: "BP Won",
                        statKeys: ["breakpoints_won_derived"],
                        marketId: "player_break_points_won",
                        background: ["Break Points Returned"]
                    }, {
                        display: "Break Points Returned",
                        supportingStats: ["Break Points Won"],
                        short: "BP Ret",
                        statKeys: ["total_breakpoints_derived"]
                    }, {
                        display: "BP Win Percentage",
                        supportingStats: ["Break Points Won"],
                        short: "BP W%",
                        statKeys: ["breakpoints_won_percentage"]
                    }, {
                        display: "Aces",
                        short: "Aces",
                        statKeys: ["aces"],
                        supportingStats: ["Double Faults", "1st Serve Percentage", "2nd Serve Percentage"],
                        marketId: "player_aces"
                    }, {
                        display: "Double Faults",
                        supportingStats: ["1st Serve Percentage", "2nd Serve Percentage"],
                        short: "DF",
                        statKeys: ["double_faults"],
                        marketId: "player_double_faults"
                    }, {
                        display: "Points Won",
                        supportingStats: ["Games Won", "Sets Won"],
                        short: "POINTS",
                        statKeys: ["points_won"],
                        marketId: "player_points"
                    }, {
                        display: "Dominance Ratio",
                        statKeys: ["dominance_ratio"],
                        supportingStats: ["Total Games Won"],
                        short: "DR"
                    }, {
                        display: "Sets Won",
                        supportingStats: ["Total Games", "Total Games Won"],
                        short: "Sets Won",
                        statKeys: ["sets_won"],
                        marketId: "player_sets_won"
                    }, {
                        display: "Sets Lost",
                        supportingStats: ["Total Games", "Total Games Won"],
                        short: "Sets Lost",
                        statKeys: ["sets_lost"],
                        marketId: "player_sets_lost"
                    }, {
                        display: "Total Sets",
                        supportingStats: ["Total Games", "Total Games Won"],
                        short: "Total Sets",
                        statKeys: ["total_sets"],
                        marketId: "total_sets"
                    }, {
                        display: "Aces Allowed",
                        supportingStats: ["Aces"],
                        short: "Aces Allowed",
                        statKeys: ["aces_allowed"]
                    }, {
                        display: "Break Points Served",
                        short: "BP Served",
                        statKeys: ["breakpoints_served_against_total"]
                    }, {
                        display: "Break Points Saved",
                        supportingStats: ["Break Points Served", "BP Given Up"],
                        short: "BP Saved",
                        statKeys: ["breakpoints_served_against_won"]
                    }, {
                        display: "BP Given Up",
                        supportingStats: ["Break Points Served", "Break Points Saved"],
                        background: ["Break Points Served"],
                        short: "BP Given Up",
                        statKeys: ["breakpoints_given_up"]
                    }, {
                        display: "1st Serve Percentage",
                        supportingStats: ["Aces", "Double Faults"],
                        short: "1st Srv %",
                        statKeys: ["first_serve_in_percentage"],
                        marketId: "player_first_serve_percentage"
                    }, {
                        display: "2nd Serve Percentage",
                        supportingStats: ["Aces", "Double Faults"],
                        short: "2nd Srv %",
                        statKeys: ["second_serve_in_percentage"],
                        marketId: "player_second_serve_percentage"
                    }, {
                        display: "Return Points Won",
                        supportingStats: ["Aces", "Double Faults"],
                        short: "Ret Pts Won",
                        statKeys: ["return_points_won"]
                    }, {
                        display: "Return Points Won %",
                        supportingStats: ["Return Points Won"],
                        short: "Ret Pts W%",
                        statKeys: ["return_points_won_percent"]
                    }]
                },
                soccer: {
                    builderMarkets: ["total_goals", "team_total", "1st_half_total_goals", "1st_half_team_total", "total_corners"],
                    esport: !1,
                    icon: r.XV_,
                    srBasePath: "/soccer-extended/production/v4/en",
                    color: "white",
                    leagues: ["usa_-_major_league_soccer", "england_-_premier_league", "spain_-_la_liga", "italy_-_serie_a", "germany_-_bundesliga", "france_-_ligue_1", "fifa_-_world_cup", "fifa_-_world_cup_qualifiers", "uefa_-_champions_league", "uefa_-_europa_league", "mexico_-_liga_mx", "argentina_-_primera_division", "argentina_-_copa_argentina", "brazil_-_serie_a", "usa_-_nwsl", "north_america_-_leagues_cup", "saudi_arabia_-_saudi_league", "england_-_championship"],
                    statMap: [{
                        display: "Minutes",
                        short: "Mins",
                        statKeys: ["minutes_played"]
                    }, {
                        display: "Goals",
                        supportingStats: ["Minutes", "Shots Attempted", "Shots On Target", "Assists"],
                        short: "Goals",
                        statKeys: ["goals_scored"],
                        marketId: "player_goals"
                    }, {
                        display: "Goals + Assists",
                        supportingStats: ["Minutes", "Goals", "Assists", "Shots Attempted", "Shots On Target"],
                        short: "G+A",
                        statKeys: ["goals_scored", "assists"],
                        marketId: "player_goals_+_assists"
                    }, {
                        display: "Shots Attempted",
                        supportingStats: ["Minutes", "Shots On Target", "Goals"],
                        short: "Shots",
                        statKeys: ["shots_total"],
                        marketId: "player_shots"
                    }, {
                        display: "Shots On Target",
                        supportingStats: ["Minutes", "Shots Attempted", "Goals"],
                        short: "SOT",
                        statKeys: ["shots_on_target"],
                        marketId: "player_shots_on_target",
                        background: ["Shots Attempted"]
                    }, {
                        display: "Pass Attempts",
                        supportingStats: ["Minutes", "Successful Passes", "Touches", "Team Possession"],
                        short: "Pass Att",
                        statKeys: ["passes_total"],
                        marketId: "player_passing_attempts"
                    }, {
                        display: "Successful Passes",
                        supportingStats: ["Minutes", "Pass Attempts", "Touches", "Team Possession"],
                        short: "Passes",
                        statKeys: ["passes_successful"],
                        background: ["Pass Attempts"],
                        marketId: "player_passing_completions"
                    }, {
                        display: "Touches",
                        supportingStats: ["Minutes", "Pass Attempts", "Team Possession"],
                        short: "Touch",
                        statKeys: ["touches"]
                    }, {
                        display: "Team Possession",
                        supportingStats: ["Minutes", "Opponent Possession"],
                        short: "Poss",
                        statKeys: ["team_possession"]
                    }, {
                        display: "Opponent Possession",
                        supportingStats: ["Minutes", "Team Possession"],
                        short: "Opp Poss",
                        statKeys: ["opponent_possession"]
                    }, {
                        display: "Assists",
                        supportingStats: ["Minutes", "Shots Assisted", "Crosses", "Successful Passes"],
                        short: "Ast",
                        statKeys: ["assists"],
                        marketId: "player_assists"
                    }, {
                        display: "Crosses",
                        supportingStats: ["Minutes", "Assists", "Shots Assisted", "Pass Attempts"],
                        short: "Cross",
                        statKeys: ["crosses_total"],
                        marketId: "player_crosses"
                    }, {
                        display: "Shots Assisted",
                        supportingStats: ["Minutes", "Assists", "Crosses"],
                        short: "SA",
                        statKeys: ["chances_created"],
                        marketId: "player_shots_assisted"
                    }, {
                        display: "Clearances",
                        supportingStats: ["Minutes", "Tackles", "Opponent Possession"],
                        short: "Clear",
                        statKeys: ["total_clearance"],
                        marketId: "player_clearances"
                    }, {
                        display: "Tackles",
                        supportingStats: ["Minutes", "Clearances", "Fouls", "Opponent Possession"],
                        short: "Tack",
                        statKeys: ["total_tackle"],
                        marketId: "player_tackles"
                    }, {
                        display: "Fouls Drawn",
                        supportingStats: ["Minutes", "Attempted Dribbles"],
                        short: "FD",
                        statKeys: ["was_fouled"],
                        marketId: "player_fouls_drawn"
                    }, {
                        display: "Goalie Saves",
                        short: "Saves",
                        statKeys: ["shots_faced_saved"],
                        background: ["Shots on Target Faced"],
                        supportingStats: ["Minutes", "Goals Allowed", "Shots on Target Faced"],
                        marketId: "player_saves"
                    }, {
                        display: "Goals Allowed",
                        short: "GA",
                        background: ["Goalie Saves"],
                        dontSubtractBg: !0,
                        statKeys: ["goals_allowed"],
                        supportingStats: ["Minutes", "Goalie Saves", "Shots on Target Faced"],
                        marketId: "player_goals_against"
                    }, {
                        display: "Shots on Target Faced",
                        short: "SOTF",
                        positions: ["GK"],
                        statKeys: ["shots_faced_saved", "goals_allowed"],
                        supportingStats: ["Minutes", "Goalie Saves", "Goals Allowed"]
                    }, {
                        display: "Attempted Dribbles",
                        short: "Drib",
                        supportingStats: ["Minutes", "Fouls Drawn", "Touches"],
                        statKeys: ["dribbles"],
                        marketId: "player_dribble_attempts"
                    }, {
                        display: "Fouls",
                        short: "Foul",
                        supportingStats: ["Minutes", "Tackles"],
                        statKeys: ["fouls_committed"],
                        marketId: "player_fouls"
                    }, {
                        display: "Fantasy Score",
                        short: "FS",
                        statKeys: ["fantasy_score"],
                        marketId: "player_fantasy_score_prizepicks_",
                        supportingStats: ["Minutes", "Goals", "Assists", "Shots Attempted", "Shots On Target", "Shots Assisted", "Tackles", "Clearances", "Attempted Dribbles", "Crosses", "Pass Attempts"],
                        supportingStatsByPosition: {
                            GK: ["Minutes", "Goalie Saves", "Goals Allowed", "Shots on Target Faced"]
                        }
                    }]
                },
                nhl: {
                    builderMarkets: ["total_goals", "team_total", "total_goals_reg_time", "1st_period_total_goals", "1st_period_team_total", "total_shots_on_goal"],
                    icon: i.AQC,
                    srBasePath: "/nhl/production/v7/en",
                    color: "cyan",
                    statMap: [...P, ...R]
                },
                lol: {
                    builderMarkets: _,
                    esport: !0,
                    leagues: ["league_of_legends"],
                    positionMap: {
                        top: "Top",
                        jungle: "Jungle",
                        mid: "Mid",
                        jun: "Jungle",
                        adc: "ADC",
                        sup: "Support",
                        support: "Support"
                    },
                    icon: o.pm1,
                    color: "amber",
                    statMap: [{
                        display: "Maps 1-2 Kills",
                        periodIndices: [0, 1],
                        supportingStats: ["Maps 1-2 Assists", "Maps 1-2 Damage", "Maps 1-2 Healing"],
                        statKeys: ["kills"],
                        short: "M 1-2K",
                        marketId: "1st_2_maps_player_kills"
                    }, {
                        display: "Maps 1-2 Assists",
                        periodIndices: [0, 1],
                        supportingStats: ["Maps 1-2 Kills", "Maps 1-2 Healing", "Maps 1-2 Damage"],
                        statKeys: ["assists"],
                        short: "M 1-2A",
                        marketId: "1st_2_maps_player_assists"
                    }, {
                        display: "Maps 1-3 Kills",
                        periodIndices: [0, 1, 2],
                        statKeys: ["kills"],
                        supportingStats: ["Maps 1-3 Assists", "Maps 1-3 Damage", "Maps 1-3 Healing"],
                        short: "M 1-3K",
                        marketId: "1st_3_maps_player_kills"
                    }, {
                        display: "Maps 1-3 Assists",
                        periodIndices: [0, 1, 2],
                        statKeys: ["assists"],
                        supportingStats: ["Maps 1-3 Kills", "Maps 1-3 Healing", "Maps 1-3 Damage"],
                        short: "M 1-3A",
                        marketId: "1st_3_maps_player_assists"
                    }, {
                        display: "Map 1 Kills",
                        periodIndices: [0],
                        statKeys: ["kills"],
                        supportingStats: ["Map 1 Assists", "Map 1 Damage", "Map 1 Healing"],
                        short: "M 1K",
                        marketId: "1st_map_player_kills"
                    }, {
                        display: "Map 2 Kills",
                        periodIndices: [1],
                        statKeys: ["kills"],
                        supportingStats: ["Map 2 Damage", "Map 2 Healing"],
                        short: "M 2K",
                        marketId: "2nd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 3 Kills",
                        periodIndices: [2],
                        statKeys: ["kills"],
                        supportingStats: ["Map 3 Damage", "Map 3 Healing"],
                        short: "M 3K",
                        marketId: "3rd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 1 Assists",
                        periodIndices: [0],
                        statKeys: ["assists"],
                        supportingStats: ["Map 1 Healing", "Map 1 Damage"],
                        short: "M 1A",
                        marketId: "1st_map_player_assists"
                    }, {
                        display: "Map 2 Assists",
                        periodIndices: [1],
                        statKeys: ["assists"],
                        supportingStats: ["Map 2 Healing", "Map 2 Damage"],
                        short: "M 2A",
                        marketId: "2nd_map_player_assists"
                    }, {
                        display: "Map 3 Assists",
                        periodIndices: [2],
                        statKeys: ["assists"],
                        supportingStats: ["Map 3 Healing", "Map 3 Damage"],
                        short: "M 3A",
                        marketId: "3rd_map_player_assists"
                    }, {
                        display: "Map 1 Deaths",
                        periodIndices: [0],
                        statKeys: ["deaths"],
                        supportingStats: ["Map 1 Damage", "Map 1 Healing"],
                        short: "M 1D",
                        marketId: "1st_map_player_deaths"
                    }, {
                        display: "Map 2 Deaths",
                        periodIndices: [1],
                        statKeys: ["deaths"],
                        supportingStats: ["Map 2 Damage", "Map 2 Healing"],
                        short: "M 2D",
                        marketId: "2nd_map_player_deaths"
                    }, {
                        display: "Map 3 Deaths",
                        periodIndices: [2],
                        statKeys: ["deaths"],
                        supportingStats: ["Map 3 Damage", "Map 3 Healing"],
                        short: "M 3D",
                        marketId: "3rd_map_player_deaths"
                    }, {
                        display: "Maps 1-2 Deaths",
                        periodIndices: [0, 1],
                        statKeys: ["deaths"],
                        supportingStats: ["Maps 1-2 Damage", "Maps 1-2 Healing"],
                        short: "M 1-2D",
                        marketId: "1st_2_maps_player_deaths"
                    }, {
                        display: "Maps 1-3 Deaths",
                        periodIndices: [0, 1, 2],
                        statKeys: ["deaths"],
                        supportingStats: ["Maps 1-3 Damage", "Maps 1-3 Healing"],
                        short: "M 1-3D",
                        marketId: "1st_3_maps_player_deaths"
                    }, {
                        display: "Map 1 Fantasy Score (UD)",
                        supportingStats: ["Maps 1 Kills", "Maps 1 Deaths", "Maps 1 Assists", "Map 1 Creep Score"],
                        periodIndices: [0],
                        statKeys: ["fantasy"],
                        short: "M1 FP",
                        marketId: "1st_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-2 Fantasy Score (UD)",
                        periodIndices: [0, 1],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1-2 Kills", "Maps 1-2 Deaths", "Maps 1-2 Assists", "Maps 1-2 Creep Score"],
                        short: "M1-2 FP",
                        marketId: "1st_2_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-3 Fantasy Score (UD)",
                        periodIndices: [0, 1, 2],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1-3 Kills", "Maps 1-3 Deaths", "Maps 1-3 Assists", "Maps 1-3 Creep Score"],
                        short: "M1-3 FP",
                        marketId: "1st_3_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 1 Creep Score",
                        periodIndices: [0],
                        statKeys: ["creep_score"],
                        short: "M 1CS",
                        marketId: "1st_map_player_creep_score"
                    }, {
                        display: "Maps 1-2 Creep Score",
                        periodIndices: [0, 1],
                        statKeys: ["creep_score"],
                        short: "M 1-2CS",
                        marketId: "1st_2_maps_player_creep_score"
                    }, {
                        display: "Maps 1-3 Creep Score",
                        periodIndices: [0, 1, 2],
                        statKeys: ["creep_score"],
                        short: "M 1-3CS",
                        marketId: "1st_3_maps_player_creep_score"
                    }, {
                        display: "Map 1 Damage",
                        periodIndices: [0],
                        statKeys: ["hero_damage"],
                        short: "M 1DMG"
                    }, {
                        display: "Map 2 Damage",
                        periodIndices: [1],
                        statKeys: ["hero_damage"],
                        short: "M 2DMG"
                    }, {
                        display: "Map 3 Damage",
                        periodIndices: [2],
                        statKeys: ["hero_damage"],
                        short: "M 3DMG"
                    }, {
                        display: "Maps 1-2 Damage",
                        periodIndices: [0, 1],
                        statKeys: ["hero_damage"],
                        short: "M 1-2DMG"
                    }, {
                        display: "Maps 1-3 Damage",
                        periodIndices: [0, 1, 2],
                        statKeys: ["hero_damage"],
                        short: "M 1-3DMG"
                    }, {
                        display: "Map 1 Healing",
                        periodIndices: [0],
                        statKeys: ["total_heal"],
                        short: "M 1H"
                    }, {
                        display: "Map 2 Healing",
                        periodIndices: [1],
                        statKeys: ["total_heal"],
                        short: "M 2H"
                    }, {
                        display: "Map 3 Healing",
                        periodIndices: [2],
                        statKeys: ["total_heal"],
                        short: "M 3H"
                    }, {
                        display: "Maps 1-2 Healing",
                        periodIndices: [0, 1],
                        statKeys: ["total_heal"],
                        short: "M 1-2H"
                    }, {
                        display: "Maps 1-3 Healing",
                        periodIndices: [0, 1, 2],
                        statKeys: ["total_heal"],
                        short: "M 1-3H"
                    }]
                },
                dota2: {
                    builderMarkets: _,
                    esport: !0,
                    icon: s => (0, n.jsx)("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0,0,256,256",
                        width: "240px",
                        height: "240px",
                        className: (0, p.Z)(s.className, "fill-slate-300"),
                        children: (0, n.jsx)("g", {
                            transform: "translate(-30.72,-30.72) scale(1.24,1.24)",
                            children: (0, n.jsx)("g", {
                                fill: "currentColor",
                                fillRule: "evenodd",
                                stroke: "none",
                                strokeWidth: "1",
                                strokeLinecap: "butt",
                                strokeLinejoin: "miter",
                                strokeMiterlimit: "10",
                                strokeDasharray: "",
                                strokeDashoffset: "0",
                                fontFamily: "none",
                                fontWeight: "none",
                                fontSize: "none",
                                textAnchor: "none",
                                children: (0, n.jsx)("g", {
                                    transform: "scale(5.33333,5.33333)",
                                    children: (0, n.jsx)("path", {
                                        d: "M12.3,27l7.7,8.333l-7.15,1.667l-3.85,-3.333zM32.622,11l3.378,1.857l-1.126,6.143l-7.882,-5.143zM11.625,11c0.375,0 0.676,0.016 1.125,0.375c0.625,0.5 2.93,2.132 2.93,2.132l0.418,0.743c0.761,0.038 0.78,0.107 1.741,0.813l21.161,14.354c-0.163,0.353 -2.679,7.583 -2.679,7.583h-3.884l-23.437,-24.75c0,0 0.382,-0.143 0.75,-0.375c0.577,-0.363 1.303,-0.875 1.875,-0.875zM14.5,6h-8.5c-0.528,0.264 -1,0.57 -1,1.625v6.875v2.125l0.988,2.748l-0.988,1.377v1.125l1,0.75v1.375l-1,1v3.75l1,0.625v4.125c-1.044,0.743 -1,1.625 -1,2.639v4.736c2.339,0.584 1.951,1.125 4.625,1.125c2.363,0 3.875,0 3.875,0c0.362,-0.023 0.644,-0.099 1,-0.133c0.994,-0.096 1.625,-0.867 1.625,-0.867l2.625,1l1,-1c0,0 1.311,1.623 1.625,2l0.875,-1l2.75,1c0,0 1.02,-0.979 2.125,-1h5.375c0.082,-0.079 1,-1 1,-1c0.421,0.252 0.049,1 3.875,1c1.056,0 2,-0.25 2,-0.25c-0.162,-0.54 -0.18,-0.43 -0.5,-0.75c0,0 2.5,0 4.125,1v-15.493l-2,0.618c0.039,-0.317 0.963,-0.738 1,-1.375c0.047,-0.803 -0.044,-3.586 -0.161,-4.174c-0.06,-0.3 -0.633,-1.179 -0.839,-1.451c0.245,-0.661 1,-1.125 1,-1.125v-0.75l1,-0.583v-4.222l-1,-4.195l1,-1.083v-1.196l-1.056,-0.915l-3.43,-0.567l-0.792,0.567l-0.396,-0.66c0,0 -5.184,-0.394 -6.124,-0.394c-1.203,0 -1.028,0.09 -1.435,1.445l-1.726,0.176l-0.166,-0.623h-1.75l0.288,-0.317c0.306,-0.289 0.199,-0.173 0.438,-0.683h-6.018c-0.094,0.172 -0.438,0.562 -0.709,1c0,0 -0.528,-0.005 -0.924,0.259c-0.396,0.264 -0.394,0.741 -0.922,0.741c-0.528,0 -1.623,0 -2.243,0c-1.32,0 -1.535,-1 -1.535,-1z"
                                    })
                                })
                            })
                        })
                    }),
                    leagues: ["dota_2"],
                    positionMap: {
                        1: "Hard Carry",
                        2: "Midlane",
                        3: "Offlane",
                        4: "Support 2",
                        5: "Support 1"
                    },
                    color: "pink",
                    statMap: [{
                        display: "Map 1 Kills",
                        periodIndices: [0],
                        statKeys: ["kills"],
                        supportingStats: ["Map 1 Damage", "Map 1 Healing"],
                        short: "M 1K",
                        marketId: "1st_map_player_kills"
                    }, {
                        display: "Map 2 Kills",
                        periodIndices: [1],
                        statKeys: ["kills"],
                        supportingStats: ["Map 2 Damage", "Map 2 Healing"],
                        short: "M 2K",
                        marketId: "2nd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 3 Kills",
                        periodIndices: [2],
                        statKeys: ["kills"],
                        supportingStats: ["Map 3 Damage", "Map 3 Healing"],
                        short: "M 3K",
                        marketId: "3rd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Maps 1-2 Kills",
                        periodIndices: [0, 1],
                        statKeys: ["kills"],
                        supportingStats: ["Maps 1-2 Damage", "Maps 1-2 Healing"],
                        short: "M 1-2K",
                        marketId: "1st_2_maps_player_kills"
                    }, {
                        display: "Maps 1-3 Kills",
                        periodIndices: [0, 1, 2],
                        statKeys: ["kills"],
                        supportingStats: ["Maps 1-3 Damage", "Maps 1-3 Healing"],
                        short: "M 1-3K",
                        marketId: "1st_3_maps_player_kills"
                    }, {
                        display: "Maps 1 Deaths",
                        periodIndices: [0],
                        statKeys: ["deaths"],
                        supportingStats: ["Maps 1 Damage", "Maps 1 Healing"],
                        short: "M 1D",
                        marketId: "1st_map_player_deaths"
                    }, {
                        display: "Maps 1-2 Deaths",
                        periodIndices: [0, 1],
                        statKeys: ["deaths"],
                        supportingStats: ["Maps 1-2 Damage", "Maps 1-2 Healing"],
                        short: "M 1-2D",
                        marketId: "1st_2_maps_player_deaths"
                    }, {
                        display: "Maps 1-3 Deaths",
                        periodIndices: [0, 1, 2],
                        statKeys: ["deaths"],
                        supportingStats: ["Maps 1-3 Damage", "Maps 1-3 Healing"],
                        short: "M 1-3D",
                        marketId: "1st_3_maps_player_deaths"
                    }, {
                        display: "Map 1 Assists",
                        periodIndices: [0],
                        statKeys: ["assists"],
                        supportingStats: ["Maps 1 Healing", "Maps 1 Damage"],
                        short: "M 1A",
                        marketId: "1st_map_player_assists"
                    }, {
                        display: "Maps 1-2 Assists",
                        periodIndices: [0, 1],
                        statKeys: ["assists"],
                        supportingStats: ["Maps 1-2 Healing", "Maps 1-2 Damage"],
                        short: "M 1-2A",
                        marketId: "1st_2_maps_player_assists"
                    }, {
                        display: "Maps 1-3 Assists",
                        periodIndices: [0, 1, 2],
                        statKeys: ["assists"],
                        supportingStats: ["Maps 1-3 Healing", "Maps 1-3 Damage"],
                        short: "M 1-3A",
                        marketId: "1st_3_maps_player_assists"
                    }, {
                        display: "Map 1 Fantasy Score (UD)",
                        periodIndices: [0],
                        statKeys: ["fantasy"],
                        supportingStats: ["Map 1 Kills", "Map 1 Deaths", "Map 1 Assists", "Map 1 Creep Score"],
                        short: "M1 FP",
                        marketId: "1st_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 2 Fantasy Score (UD)",
                        periodIndices: [1],
                        statKeys: ["fantasy"],
                        supportingStats: ["Map 2 Kills", "Map 2 Deaths", "Map 2 Assists", "Map 2 Creep Score"],
                        short: "M2 FP",
                        marketId: "2nd_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 3 Fantasy Score (UD)",
                        periodIndices: [2],
                        statKeys: ["fantasy"],
                        supportingStats: ["Map 3 Kills", "Map 3 Deaths", "Map 3 Assists", "Map 3 Creep Score"],
                        short: "M3 FP",
                        marketId: "3rd_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-2 Fantasy Score (UD)",
                        periodIndices: [0, 1],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1-2 Kills", "Maps 1-2 Deaths", "Maps 1-2 Assists", "Maps 1-2 Creep Score"],
                        short: "M1-2 FP",
                        marketId: "1st_2_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-3 Fantasy Score (UD)",
                        supportingStats: ["Maps 1-3 Kills", "Maps 1-3 Deaths", "Maps 1-3 Assists", "Maps 1-3 Creep Score"],
                        short: "M1-3 FP",
                        periodIndices: [0, 1, 2],
                        statKeys: ["fantasy"],
                        marketId: "1st_3_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 1 Creep Score",
                        periodIndices: [0],
                        statKeys: ["last_hits"],
                        short: "M 1CS",
                        marketId: "1st_map_player_creep_score"
                    }, {
                        display: "Maps 1-2 Creep Score",
                        periodIndices: [0, 1],
                        statKeys: ["last_hits"],
                        short: "M 1-2CS",
                        marketId: "1st_2_maps_player_creep_score"
                    }, {
                        display: "Maps 1-3 Creep Score",
                        periodIndices: [0, 1, 2],
                        statKeys: ["last_hits"],
                        short: "M 1-3CS",
                        marketId: "1st_3_maps_player_creep_score"
                    }, {
                        display: "Map 1 Damage",
                        periodIndices: [0],
                        statKeys: ["hero_damage"],
                        short: "M 1D",
                        marketId: "1st_map_player_damage"
                    }, {
                        display: "Map 2 Damage",
                        periodIndices: [1],
                        statKeys: ["hero_damage"],
                        short: "M 2D",
                        marketId: "2nd_map_player_damage"
                    }, {
                        display: "Map 3 Damage",
                        periodIndices: [2],
                        statKeys: ["hero_damage"],
                        short: "M 3D",
                        marketId: "3rd_map_player_damage"
                    }, {
                        display: "Maps 1-2 Damage",
                        periodIndices: [0, 1],
                        statKeys: ["hero_damage"],
                        short: "M 1-2D",
                        marketId: "1st_2_maps_player_damage"
                    }, {
                        display: "Maps 1-3 Damage",
                        periodIndices: [0, 1, 2],
                        statKeys: ["hero_damage"],
                        short: "M 1-3D",
                        marketId: "1st_3_maps_player_damage"
                    }, {
                        display: "Map 1 Healing",
                        periodIndices: [0],
                        statKeys: ["heal"],
                        short: "M 1H",
                        marketId: "1st_map_player_healing"
                    }, {
                        display: "Map 2 Healing",
                        periodIndices: [1],
                        statKeys: ["heal"],
                        short: "M 2H",
                        marketId: "2nd_map_player_healing"
                    }, {
                        display: "Map 3 Healing",
                        periodIndices: [2],
                        statKeys: ["heal"],
                        short: "M 3H",
                        marketId: "3rd_map_player_healing"
                    }, {
                        display: "Maps 1-2 Healing",
                        periodIndices: [0, 1],
                        statKeys: ["heal"],
                        short: "M 1-2H",
                        marketId: "1st_2_maps_player_healing"
                    }, {
                        display: "Maps 1-3 Healing",
                        periodIndices: [0, 1, 2],
                        statKeys: ["heal"],
                        short: "M 1-3H",
                        marketId: "1st_3_maps_player_healing"
                    }]
                },
                cs2: {
                    builderMarkets: _,
                    esport: !0,
                    icon: o.Rd_,
                    color: "orange",
                    statMap: [{
                        display: "Map 1 Kills",
                        periodIndices: [0],
                        statKeys: ["kills"],
                        short: "M 1K",
                        marketId: "1st_map_player_kills"
                    }, {
                        display: "Map 2 Kills",
                        periodIndices: [1],
                        statKeys: ["kills"],
                        short: "M 2K",
                        marketId: "2nd_map_player_kills"
                    }, {
                        display: "Map 3 Kills",
                        periodIndices: [2],
                        statKeys: ["kills"],
                        short: "M 3K",
                        marketId: "3rd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Maps 1-2 Kills",
                        periodIndices: [0, 1],
                        statKeys: ["kills"],
                        short: "M 1-2K",
                        marketId: "1st_2_maps_player_kills"
                    }, {
                        display: "Maps 1-3 Kills",
                        periodIndices: [0, 1, 2],
                        statKeys: ["kills"],
                        short: "M 1-3K",
                        marketId: "1st_3_maps_player_kills"
                    }, {
                        display: "Map 1 HS",
                        periodIndices: [0],
                        statKeys: ["headshots"],
                        short: "M 1HS",
                        supportingStats: ["Map 1 Kills"],
                        marketId: "1st_map_player_headshots"
                    }, {
                        display: "Map 2 HS",
                        periodIndices: [1],
                        statKeys: ["headshots"],
                        short: "M 2HS",
                        supportingStats: ["Map 2 Kills"],
                        marketId: "2nd_map_player_headshots",
                        includeLive: !0
                    }, {
                        display: "Map 3 HS",
                        periodIndices: [2],
                        statKeys: ["headshots"],
                        short: "M 3HS",
                        supportingStats: ["Map 3 Kills"],
                        marketId: "3rd_map_player_headshots",
                        includeLive: !0
                    }, {
                        display: "Maps 1-2 HS",
                        periodIndices: [0, 1],
                        statKeys: ["headshots"],
                        short: "M 1-2HS",
                        supportingStats: ["Maps 1-2 Kills"],
                        marketId: "1st_2_maps_player_headshots"
                    }, {
                        display: "Maps 1-3 HS",
                        periodIndices: [0, 1, 2],
                        statKeys: ["headshots"],
                        short: "M 1-3HS",
                        supportingStats: ["Maps 1-3 Kills"],
                        marketId: "1st_3_maps_player_headshots"
                    }, {
                        display: "Map 1 Assists",
                        periodIndices: [0],
                        statKeys: ["assists"],
                        short: "M 1A",
                        marketId: "1st_map_player_assists"
                    }, {
                        display: "Map 2 Assists",
                        periodIndices: [1],
                        statKeys: ["assists"],
                        short: "M 2A",
                        marketId: "2nd_map_player_assists"
                    }, {
                        display: "Map 3 Assists",
                        periodIndices: [2],
                        statKeys: ["assists"],
                        short: "M 3A",
                        marketId: "3rd_map_player_assists"
                    }, {
                        display: "Maps 1-2 Assists",
                        periodIndices: [0, 1],
                        statKeys: ["assists"],
                        short: "M 1-2A",
                        marketId: "1st_2_maps_player_assists"
                    }, {
                        display: "Maps 1-3 Assists",
                        periodIndices: [0, 1, 2],
                        statKeys: ["assists"],
                        short: "M 1-3A",
                        marketId: "1st_3_maps_player_assists"
                    }]
                },
                val: {
                    builderMarkets: _,
                    icon: o.uu4,
                    esport: !0,
                    color: "red",
                    leagues: ["valorant"],
                    statMap: [{
                        display: "Map 1 Kills",
                        periodIndices: [0],
                        statKeys: ["kills"],
                        short: "M 1K",
                        marketId: "1st_map_player_kills"
                    }, {
                        display: "Map 2 Kills",
                        periodIndices: [1],
                        statKeys: ["kills"],
                        short: "M 2K",
                        marketId: "2nd_map_player_kills"
                    }, {
                        display: "Map 3 Kills",
                        periodIndices: [2],
                        statKeys: ["kills"],
                        short: "M 3K",
                        marketId: "3rd_map_player_kills"
                    }, {
                        display: "Maps 1-2 Kills",
                        periodIndices: [0, 1],
                        statKeys: ["kills"],
                        short: "M 1-2K",
                        marketId: "1st_2_maps_player_kills"
                    }, {
                        display: "Maps 1-3 Kills",
                        periodIndices: [0, 1, 2],
                        statKeys: ["kills"],
                        short: "M 1-3K",
                        marketId: "1st_3_maps_player_kills"
                    }, {
                        display: "Map 1 Assists",
                        periodIndices: [0],
                        statKeys: ["assists"],
                        short: "M 1A",
                        marketId: "1st_map_player_assists"
                    }, {
                        display: "Map 2 Assists",
                        periodIndices: [1],
                        statKeys: ["assists"],
                        short: "M 2A",
                        marketId: "2nd_map_player_assists"
                    }, {
                        display: "Map 3 Assists",
                        periodIndices: [2],
                        statKeys: ["assists"],
                        short: "M 3A",
                        marketId: "3rd_map_player_assists"
                    }, {
                        display: "Maps 1-2 Assists",
                        periodIndices: [0, 1],
                        statKeys: ["assists"],
                        short: "M 1-2A",
                        marketId: "1st_2_maps_player_assists"
                    }, {
                        display: "Maps 1-3 Assists",
                        periodIndices: [0, 1, 2],
                        statKeys: ["assists"],
                        short: "M 1-3A",
                        marketId: "1st_3_maps_player_assists"
                    }, {
                        display: "Maps 1 First Blood",
                        periodIndices: [0],
                        statKeys: ["first_kills"],
                        short: "M 1FB",
                        marketId: "1st_maps_player_first_bloods"
                    }, {
                        display: "Map 2 First Bloods",
                        periodIndices: [1],
                        statKeys: ["first_kills"],
                        short: "M 2FB",
                        marketId: "2nd_map_player_first_bloods"
                    }, {
                        display: "Map 3 First Bloods",
                        periodIndices: [2],
                        statKeys: ["first_kills"],
                        short: "M 3FB",
                        marketId: "3rd_map_player_first_bloods"
                    }, {
                        display: "Maps 1-2 First Blood",
                        periodIndices: [0, 1],
                        statKeys: ["first_kills"],
                        short: "M 1-2FB",
                        marketId: "1st_2_maps_player_first_bloods"
                    }, {
                        display: "Maps 1-3 First Blood",
                        periodIndices: [0, 1, 2],
                        statKeys: ["first_kills"],
                        short: "M 1-3FB",
                        marketId: "1st_3_maps_player_first_bloods"
                    }]
                },
                cod: {
                    builderMarkets: _,
                    esport: !0,
                    icon: s => (0, n.jsxs)("svg", {
                        viewBox: "0 0 48 48",
                        xmlns: "http://www.w3.org/2000/svg",
                        width: "240px",
                        height: "240px",
                        className: (0, p.Z)(s.className, "fill-slate-300"),
                        children: [(0, n.jsx)("g", {
                            id: "SVGRepo_bgCarrier",
                            strokeWidth: "0"
                        }), (0, n.jsx)("g", {
                            id: "SVGRepo_tracerCarrier",
                            strokeLinecap: "round",
                            strokeLinejoin: "round"
                        }), (0, n.jsxs)("g", {
                            id: "SVGRepo_iconCarrier",
                            children: [(0, n.jsx)("defs", {
                                children: (0, n.jsx)("style", {})
                            }), (0, n.jsx)("path", {
                                d: "M6.35,37.1942c11.7668,7.215,23.5328,6.9512,35.3,0L34.0482,32.64c-6.3706,3.9005-12.97,4.2117-20.0967,0Z"
                            }), (0, n.jsx)("path", {
                                d: "M6.35,24.1018V16.4174l17.555-10.91L41.65,16.5121v7.59L23.9052,13.5712Z"
                            }), (0, n.jsx)("path", {
                                d: "M6.35,37.1942V30.6483l17.555-10.3642L41.65,30.6483v6.5459L23.9052,26.4854Z"
                            })]
                        })]
                    }),
                    color: "orange",
                    leagues: ["call_of_duty"],
                    statMap: [{
                        display: "Map 1 Kills",
                        periodIndices: [0],
                        statKeys: ["kills"],
                        short: "M 1K",
                        marketId: "1st_map_player_kills"
                    }, {
                        display: "Map 2 Kills",
                        periodIndices: [1],
                        statKeys: ["kills"],
                        short: "M 2K",
                        marketId: "2nd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 3 Kills",
                        periodIndices: [2],
                        statKeys: ["kills"],
                        short: "M 3K",
                        marketId: "3rd_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 4 Kills",
                        periodIndices: [3],
                        statKeys: ["kills"],
                        short: "M 4K",
                        marketId: "4th_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Map 5 Kills",
                        periodIndices: [4],
                        statKeys: ["kills"],
                        short: "M 5K",
                        marketId: "5th_map_player_kills",
                        includeLive: !0
                    }, {
                        display: "Maps 1-2 Kills",
                        periodIndices: [0, 1],
                        statKeys: ["kills"],
                        short: "M 1-2K",
                        marketId: "1st_2_maps_player_kills"
                    }, {
                        display: "Maps 1-3 Kills",
                        periodIndices: [0, 1, 2],
                        statKeys: ["kills"],
                        short: "M 1-3K",
                        marketId: "1st_3_maps_player_kills"
                    }, {
                        display: "Series K/D",
                        periodIndices: [0],
                        statKeys: ["series_kd"],
                        short: "K/D",
                        supportingStats: ["Maps 1-3 Kills"],
                        marketId: "player_k_d"
                    }, {
                        display: "Map 1 Fantasy Score (UD)",
                        periodIndices: [0],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1 Kills", "Maps 1 Deaths", "Maps 1 Assists", "Map 1 Creep Score"],
                        short: "M1 FP",
                        marketId: "1st_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 2 Fantasy Score (UD)",
                        periodIndices: [1],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 2 Kills", "Maps 2 Deaths", "Maps 2 Assists", "Map 2 Creep Score"],
                        short: "M2 FP",
                        marketId: "2nd_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 3 Fantasy Score (UD)",
                        periodIndices: [2],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 3 Kills", "Maps 3 Deaths", "Maps 3 Assists", "Map 3 Creep Score"],
                        short: "M3 FP",
                        marketId: "3rd_map_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-2 Fantasy Score (UD)",
                        periodIndices: [0, 1],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1-2 Kills", "Maps 1-2 Deaths", "Maps 1-2 Assists", "Maps 1-2 Creep Score"],
                        short: "M1-2 FP",
                        marketId: "1st_2_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Maps 1-3 Fantasy Score (UD)",
                        periodIndices: [0, 1, 2],
                        statKeys: ["fantasy"],
                        supportingStats: ["Maps 1-3 Kills", "Maps 1-3 Deaths", "Maps 1-3 Assists", "Maps 1-3 Creep Score"],
                        short: "M1-3 FP",
                        marketId: "1st_3_maps_player_fantasy_score_underdog_"
                    }, {
                        display: "Map 1 First Bloods",
                        periodIndices: [0],
                        statKeys: ["first_blood_count"],
                        short: "M 1FB",
                        marketId: "1st_map_player_first_bloods"
                    }, {
                        display: "Map 2 First Bloods",
                        periodIndices: [1],
                        statKeys: ["first_blood_count"],
                        short: "M 2FB",
                        marketId: "2nd_map_player_first_bloods"
                    }, {
                        display: "Map 3 First Bloods",
                        periodIndices: [2],
                        statKeys: ["first_blood_count"],
                        short: "M 3FB",
                        marketId: "3rd_map_player_first_bloods"
                    }, {
                        display: "Map 1 Damage",
                        periodIndices: [0],
                        statKeys: ["damage"],
                        short: "M 1DMG",
                        marketId: "1st_map_player_damage"
                    }, {
                        display: "Map 2 Damage",
                        periodIndices: [1],
                        statKeys: ["damage"],
                        short: "M 2DMG",
                        marketId: "2nd_map_player_damage"
                    }, {
                        display: "Map 3 Damage",
                        periodIndices: [2],
                        statKeys: ["damage"],
                        short: "M 3DMG",
                        marketId: "3rd_map_player_damage"
                    }, {
                        display: "Map 4 Damage",
                        periodIndices: [3],
                        statKeys: ["damage"],
                        short: "M 4DMG",
                        marketId: "4th_map_player_damage"
                    }, {
                        display: "Map 5 Damage",
                        periodIndices: [4],
                        statKeys: ["damage"],
                        short: "M 5DMG",
                        marketId: "5th_map_player_damage"
                    }, {
                        display: "Maps 1-2 Damage",
                        periodIndices: [0, 1],
                        statKeys: ["damage"],
                        short: "M 1-2DMG",
                        marketId: "1st_2_maps_player_damage"
                    }, {
                        display: "Maps 1-3 Damage",
                        periodIndices: [0, 1, 2],
                        statKeys: ["damage"],
                        short: "M 1-3DMG",
                        marketId: "1st_3_maps_player_damage"
                    }]
                }
            }
        },
        97848: function(s, t, e) {
            e.d(t, {
                C: function() {
                    return p
                }
            });
            var a = e(10131),
                r = e(63210),
                i = e(93630),
                o = e(84860);
            let n = new Set(["mlb", "nfl", "nba", "cbb", "cfb", "nhl", "lol", "dota2", "cs2", "val", "cod", "tennis", "soccer", "wnba"]);

            function p(s) {
                let {
                    sport: t,
                    displayText: e,
                    className: p,
                    trim: l,
                    size: d = 16,
                    overlay: c
                } = s, _ = function(s) {
                    var t;
                    let e = (null === (t = i.ZP[s]) || void 0 === t ? void 0 : t.color) || "gray";
                    return (0, r.W)("inline-flex items-center justify-center text-xxs font-medium px-2 py-0.5 rounded-md", "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50", "transition-all duration-200 hover:bg-slate-700/60", {
                        "text-blue-300 border-blue-500/20 hover:border-blue-400/30": "blue" === e,
                        "text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-400/30": "fuchsia" === e,
                        "text-emerald-300 border-emerald-500/20 hover:border-emerald-400/30": "green" === e,
                        "text-rose-300 border-rose-500/20 hover:border-rose-400/30": "rose" === e,
                        "text-cyan-300 border-cyan-500/20 hover:border-cyan-400/30": "cyan" === e,
                        "text-red-300 border-red-500/20 hover:border-red-400/30": "red" === e,
                        "text-yellow-300 border-yellow-500/20 hover:border-yellow-400/30": "yellow" === e,
                        "text-slate-200 border-slate-400/20 hover:border-slate-300/30": "white" === e,
                        "text-amber-300 border-amber-500/20 hover:border-amber-400/30": "amber" === e,
                        "text-pink-300 border-pink-500/20 hover:border-pink-400/30": "pink" === e,
                        "text-orange-300 border-orange-500/20 hover:border-orange-400/30": "orange" === e,
                        "text-slate-300 border-slate-500/20 hover:border-slate-400/30": !["blue", "fuchsia", "green", "rose", "cyan", "red", "yellow", "white", "amber", "pink", "orange"].includes(e)
                    })
                }(t), u = null != e ? e : function(s, t) {
                    let e = s.toLowerCase();
                    if (t) {
                        if ("soccer" === e) return "SOC";
                        if ("tennis" === e) return "TEN"
                    }
                    return s.toUpperCase()
                }(t, l), y = n.has(t) ? (0, a.jsx)(o.T, {
                    league: t,
                    size: c ? 16 : d,
                    grayscale: !1,
                    className: c ? void 0 : "mr-0.5"
                }) : (0, a.jsx)("span", {
                    className: (0, r.W)(_, c && "px-1.5 !py-0 text-[10px] leading-4 rounded-md bg-slate-900/80 border-white/10", p),
                    children: u
                });
                return c ? (0, a.jsx)("div", {
                    className: "absolute -bottom-2 -right-0 pointer-events-none",
                    children: y
                }) : y
            }
        },
        58685: function(s, t, e) {
            e.d(t, {
                cn: function() {
                    return i
                },
                mL: function() {
                    return n
                }
            });
            var a = e(63210),
                r = e(86470);

            function i() {
                for (var s = arguments.length, t = Array(s), e = 0; e < s; e++) t[e] = arguments[e];
                return (0, r.m)((0, a.W)(t))
            }
            e(72044);
            let o = {
                round_of_128: "Round of 128",
                round_of_64: "Round of 64",
                round_of_32: "Round of 32",
                round_of_16: "Round of 16",
                quarterfinal: "Quarterfinals",
                semifinal: "Semifinals",
                qualification: "Qualification",
                qualification_round_1: "Qual Round 1",
                qualification_round_2: "Qual Round 2",
                qualification_round_3: "Qual Round 3",
                qualification_final: "Qual Final",
                final: "Final",
                hardcourt_outdoor: "Hardcourt Outdoor",
                hardcourt_indoor: "Hardcourt Indoor",
                red_clay: "Red Clay",
                red_clay_outdoor: "Red Clay Outdoor",
                red_clay_indoor: "Red Clay Indoor",
                grass: "Grass"
            };

            function n(s) {
                return o[s] || s.charAt(0).toUpperCase() + s.slice(1)
            }
        }
    }
]);