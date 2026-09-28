(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [5642], {
        56147: function(e, t, r) {
            Promise.resolve().then(r.bind(r, 81397)), Promise.resolve().then(r.bind(r, 59160))
        },
        81397: function(e, t, r) {
            "use strict";
            r.d(t, {
                default: function() {
                    return ex
                }
            });
            var i = r(10131),
                s = r(13881),
                l = r(36098),
                n = r(86917),
                a = r(6672),
                o = r(92827),
                d = r(41915),
                c = r(55185),
                u = r(69237),
                p = r(8933),
                f = r(28876),
                m = r(34772),
                x = r(59160);
            let h = () => (0, i.jsx)(o.Z, {
                className: "ml-auto !size-3.5 !text-sidebar-foreground/35 group-data-[collapsible=icon]:hidden",
                "aria-hidden": !0
            });

            function v(e) {
                var t, r;
                let {
                    section: s
                } = e, {
                    user: l,
                    isLoaded: n,
                    isSignedIn: o
                } = (0, u.aF)(), {
                    isWebViewApp: v
                } = (0, x.B)(), [g, b] = (0, c.useState)(!1), j = g && n && !(0, f.nt)(null == l ? void 0 : null === (t = l.publicMetadata) || void 0 === t ? void 0 : t.plan);
                return (0, c.useEffect)(() => {
                    b(!0)
                }, []), (0, i.jsxs)(a.Hz, {
                    children: [(0, i.jsxs)(a.nO, {
                        className: "justify-between gap-2",
                        children: [(0, i.jsx)("span", {
                            children: s.title
                        }), null !== (r = s.labelAddon) && void 0 !== r ? r : null]
                    }), (0, i.jsx)(a.w3, {
                        children: s.items.map(e => {
                            let t = e.url.startsWith("http"),
                                r = "/players" === e.url;
                            return e.locked ? (0, i.jsx)(a.LO, {
                                children: (0, i.jsxs)(a.bb, {
                                    isActive: e.isActive,
                                    title: e.locked.title,
                                    onClick: e.locked.onClick,
                                    children: [(0, i.jsx)(e.icon, {}), (0, i.jsx)("span", {
                                        children: e.title
                                    }), (0, i.jsx)(h, {})]
                                })
                            }, e.title) : r && j ? (0, i.jsx)(a.LO, {
                                children: (0, i.jsx)(p.vX, {
                                    asChild: !0,
                                    onClick: () => {
                                        var e;
                                        m.co.trackLockedFilterClicked({
                                            source: "player_page",
                                            featureName: "Player Pages",
                                            trigger: "player_search_nav",
                                            ...(0, m.cz)({
                                                isSignedIn: o,
                                                plan: null == l ? void 0 : null === (e = l.publicMetadata) || void 0 === e ? void 0 : e.plan,
                                                isPwa: v,
                                                isWebView: v
                                            })
                                        })
                                    },
                                    featureName: "Player Pages",
                                    title: "Unlock Player Search",
                                    description: "Search every player, open full stat pages, and join our premium Discord with admin picks.",
                                    benefits: f.vR.playerSearch,
                                    source: "player_page",
                                    children: (0, i.jsxs)(a.bb, {
                                        isActive: e.isActive,
                                        title: "Premium feature",
                                        children: [(0, i.jsx)(e.icon, {}), (0, i.jsx)("span", {
                                            children: e.title
                                        }), (0, i.jsx)(h, {})]
                                    })
                                })
                            }, e.title) : (0, i.jsx)(a.LO, {
                                children: (0, i.jsx)(a.bb, {
                                    isActive: e.isActive,
                                    tooltip: e.title,
                                    asChild: !0,
                                    children: t ? (0, i.jsxs)(d.default, {
                                        href: e.url,
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: [(0, i.jsx)(e.icon, {}), (0, i.jsx)("span", {
                                            children: e.title
                                        })]
                                    }) : (0, i.jsxs)(d.default, {
                                        href: e.url,
                                        prefetch: !0,
                                        children: [(0, i.jsx)(e.icon, {}), (0, i.jsx)("span", {
                                            children: e.title
                                        })]
                                    })
                                })
                            }, e.title)
                        })
                    })]
                })
            }
            var g = r(70083),
                b = r(84003),
                j = r(93368),
                w = r(95820),
                y = r(47068),
                N = r(48307),
                k = r(75837),
                C = r(38216),
                P = r(67057),
                _ = r(6094);

            function A() {
                return (0, i.jsx)(a.w3, {
                    children: (0, i.jsx)(a.LO, {
                        children: (0, i.jsxs)(d.default, {
                            className: "flex h-12 w-full items-center justify-center gap-2 px-2 text-sidebar-foreground outline-none focus:outline-none focus-visible:outline-none group-data-[collapsible=icon]:px-0",
                            href: "/",
                            prefetch: !1,
                            children: [(0, i.jsx)(_.Z, {
                                className: "shrink-0",
                                width: 26,
                                height: 26
                            }), (0, i.jsx)("h1", {
                                className: "text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden",
                                children: "PickFinder"
                            })]
                        })
                    })
                })
            }
            var F = r(10553),
                L = r(97869),
                S = r(54586),
                Z = r(63210),
                R = r(9379);

            function O() {
                var e;
                let {
                    state: t,
                    openMobile: r,
                    isMobile: s
                } = (0, a.Ap)(), {
                    user: l,
                    isLoaded: n,
                    isSignedIn: o
                } = (0, u.aF)(), {
                    isWebViewApp: d
                } = (0, x.B)(), [h, v] = (0, c.useState)(!1), g = (0, f.nt)(null == l ? void 0 : null === (e = l.publicMetadata) || void 0 === e ? void 0 : e.plan);
                return (0, i.jsxs)(i.Fragment, {
                    children: [(0, i.jsxs)(a.w3, {
                        children: [(0, i.jsx)(a.LO, {
                            children: (0, i.jsx)(S.W, {
                                children: (0, i.jsxs)(a.bb, {
                                    className: "overflow-hidden gray-button h-12 text-nowrap !text-xs flex justify-center gap-2 text-white hover:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                                    children: [(0, i.jsx)(F.Z, {
                                        className: "w-5 h-5"
                                    }), "collapsed" !== t || r && s ? "Video Guide" : ""]
                                })
                            })
                        }), (0, i.jsx)(a.LO, {
                            children: (0, i.jsx)(p.vX, {
                                asChild: !0,
                                onClick: e => {
                                    var t;
                                    if (!n) {
                                        e.preventDefault();
                                        return
                                    }
                                    if (g) {
                                        e.preventDefault(), v(!0);
                                        return
                                    }
                                    m.co.trackDiscordPaywallTriggered({
                                        source: "discord",
                                        featureName: "Discord Access",
                                        ...(0, m.cz)({
                                            isSignedIn: o,
                                            plan: null == l ? void 0 : null === (t = l.publicMetadata) || void 0 === t ? void 0 : t.plan,
                                            isPwa: d,
                                            isWebView: d
                                        })
                                    })
                                },
                                featureName: "Discord Access",
                                title: "Unlock Discord Access",
                                description: "Upgrade to join the private PickFinder Discord and get the member role on your linked Discord account.",
                                benefits: f.vR.discord,
                                source: "discord",
                                children: (0, i.jsxs)(a.bb, {
                                    className: "overflow-hidden blue-button h-12 text-nowrap !text-xs flex justify-center gap-2 text-white hover:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                                    children: [(0, i.jsx)(L.j2d, {
                                        className: (0, Z.Z)("w-5 h-5 fill-white")
                                    }), "collapsed" !== t || r && s ? "Get Discord Access" : ""]
                                })
                            })
                        })]
                    }), (0, i.jsx)(R.f, {
                        open: h,
                        onOpenChange: v
                    })]
                })
            }
            var M = r(68886);

            function z(e) {
                let {
                    className: t
                } = e, {
                    state: r,
                    mounted: s,
                    isLoaded: l
                } = (0, M.sx)(), {
                    openProTrial: n,
                    openProUpgrade: a,
                    openProTrialStatus: o
                } = (0, M.An)();
                if (!s || !l || !r.hasPaid || r.isComped) return null;
                let d = "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors";
                if (r.isTrial) {
                    let e = "Trial \xb7 ".concat(r.trialDaysLeft, "d left"),
                        s = "stripe" === r.trialProvider ? o : () => a({
                            source: "sidebar_trial_badge"
                        });
                    return (0, i.jsx)("button", {
                        type: "button",
                        onClick: s,
                        className: (0, Z.Z)(d, "bg-[#3461FF] text-white shadow-[0_6px_18px_-8px_rgba(52,97,255,0.9)] hover:bg-[#4a72ff]", t),
                        title: "stripe" === r.trialProvider ? "Manage your Pro trial" : "Keep Pro after your trial",
                        children: e
                    })
                }
                return r.isTrialEligible ? (0, i.jsxs)("button", {
                    type: "button",
                    onClick: () => n("sidebar_badge"),
                    className: (0, Z.Z)(d, "bg-[#3461FF] text-white shadow-[0_6px_18px_-8px_rgba(52,97,255,0.9)] hover:bg-[#4a72ff]", t),
                    title: "Try Pro free for ".concat(f.Vf, " days"),
                    children: [f.Vf, "-Day Trial"]
                }) : r.hasPro ? null : (0, i.jsx)("button", {
                    type: "button",
                    onClick: () => a({
                        source: "sidebar_badge"
                    }),
                    className: (0, Z.Z)(d, "bg-[#3461FF] text-white shadow-[0_6px_18px_-8px_rgba(52,97,255,0.9)] hover:bg-[#4a72ff]", t),
                    title: "Upgrade to Pro",
                    children: "Upgrade"
                })
            }
            var E = r(1228),
                T = r(37687),
                D = r(86128),
                B = r(59564),
                I = r(63833),
                U = r(66961),
                W = r(9924),
                V = r(37866),
                q = r(4695),
                K = r(98533),
                X = r.n(K),
                G = r(85793),
                H = r(81057),
                J = r(55212),
                $ = r(97848),
                Y = r(63855),
                Q = r(50555),
                ee = r(46434),
                et = r(47288),
                er = r(29562);
            let ei = {
                prizepicks: {
                    name: "PrizePicks",
                    primary: "#9333ea",
                    gradient: "from-purple-500 to-purple-700",
                    qrColor: "#9333ea"
                },
                draftkings: {
                    name: "DraftKings",
                    primary: "#22c55e",
                    gradient: "from-green-500 to-green-700",
                    qrColor: "#22c55e"
                },
                fanduel: {
                    name: "FanDuel",
                    primary: "#3b82f6",
                    gradient: "from-blue-500 to-blue-700",
                    qrColor: "#3b82f6"
                },
                caesars: {
                    name: "Caesars",
                    primary: "#eab308",
                    gradient: "from-yellow-500 to-yellow-700",
                    qrColor: "#eab308"
                },
                sleeper: {
                    name: "Sleeper",
                    primary: "#06b6d4",
                    gradient: "from-cyan-500 to-cyan-700",
                    qrColor: "#06b6d4"
                },
                hardrockbet: {
                    name: "Hard Rock Bet",
                    primary: "#8b5cf6",
                    gradient: "from-violet-500 to-violet-700",
                    qrColor: "#8b5cf6"
                },
                betmgm: {
                    name: "BetMGM",
                    primary: "#d97706",
                    gradient: "from-amber-500 to-amber-700",
                    qrColor: "#d97706"
                },
                novig: {
                    name: "Novig",
                    primary: "#179be6",
                    gradient: "from-blue-500 to-blue-700",
                    qrColor: "#179be6"
                }
            };

            function es() {
                let {
                    favorites: e
                } = (0, s.r)(), t = (0, H.Z)(), r = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.prizepicks
                }).length, l = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.fanduel
                }).length, n = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.draftkings
                }).length, a = e.filter(e => {
                    var t, r, i, s, l;
                    return null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.sleeper) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.ios
                }).length, o = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.caesars
                }).length, d = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.hardrockbet
                }).length, u = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.betmgm
                }).length, p = e.filter(e => {
                    var t;
                    return null === (t = e.prop.apps) || void 0 === t ? void 0 : t.novig
                }).length, [f, m] = (0, c.useState)(!1), [x, h] = (0, c.useState)(""), [v, g] = (0, c.useState)("prizepicks"), [b, j] = (0, c.useState)(!1), w = r => {
                    var i, s, l, n, a, o, d, c, u, p, f, x, v, b, j, w, y;
                    for (let t of Object.keys(e[0].prop.apps)) console.log(r, t, null === (s = e[0].prop.apps[t].outcomes) || void 0 === s ? void 0 : null === (i = s.over) || void 0 === i ? void 0 : i.deep_link);
                    let N = "";
                    if ("sleeper" === r) {
                        let t = e.map(e => {
                            var t, r, i, s, l;
                            let n = null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.sleeper) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.ios;
                            return n ? new URL(n).searchParams.get("lids") : null
                        }).filter(Boolean).join(",");
                        t && (N = "https://sleeper.com/picks/entry?lids=".concat(t))
                    } else {
                        let t = e.filter(e => {
                                var t, i, s, l, n;
                                return null === (n = e.prop.apps) || void 0 === n ? void 0 : null === (l = n[r]) || void 0 === l ? void 0 : null === (s = l.outcomes) || void 0 === s ? void 0 : null === (i = s[e.selection]) || void 0 === i ? void 0 : null === (t = i.deep_link) || void 0 === t ? void 0 : t.desktop
                            }),
                            i = t[0],
                            s = t.slice(1);
                        if (i && (N = (null === (d = i.prop.apps) || void 0 === d ? void 0 : null === (o = d[r]) || void 0 === o ? void 0 : null === (a = o.outcomes) || void 0 === a ? void 0 : null === (n = a[i.selection]) || void 0 === n ? void 0 : null === (l = n.deep_link) || void 0 === l ? void 0 : l.desktop) || ""), s.length > 0 || "hardrockbet" === r) {
                            if ("prizepicks" === r) N += ",".concat(s.map(e => {
                                var t, r, i, s, l;
                                return "".concat(null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.prizepicks) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.desktop.replace("https://app.prizepicks.com/?projections=", ""))
                            }).join(","));
                            else if ("draftkings" === r) N += ",".concat(s.map(e => {
                                var t, r, i, s, l;
                                return "".concat(null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.draftkings) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.desktop.split("?outcomes=")[1])
                            }).join(","));
                            else if ("fanduel" === r) {
                                let e = [i, ...s].map((e, t) => {
                                    var r, i, s, l, n;
                                    let a = null === (n = e.prop.apps) || void 0 === n ? void 0 : null === (l = n.fanduel) || void 0 === l ? void 0 : null === (s = l.outcomes) || void 0 === s ? void 0 : null === (i = s[e.selection]) || void 0 === i ? void 0 : null === (r = i.deep_link) || void 0 === r ? void 0 : r.desktop;
                                    if (!a) return null;
                                    let o = new URLSearchParams(a.split("?")[1]),
                                        d = o.get("marketId"),
                                        c = o.get("selectionId");
                                    return d && c ? "marketId[".concat(t, "]=").concat(d, "&selectionId[").concat(t, "]=").concat(c) : null
                                }).filter(Boolean).join("&");
                                N = "https://sportsbook.fanduel.com/addToBetslip?".concat(e)
                            } else if ("caesars" === r)
                                for (let e of (N = "https://sportsbook.caesars.com/<COUNTRY/ny/bet/betslip?af_c_id=VAULT2720X&selectionIds=", [i, ...s])) N += "".concat(null === (x = e.prop.apps) || void 0 === x ? void 0 : null === (f = x.caesars) || void 0 === f ? void 0 : null === (p = f.outcomes) || void 0 === p ? void 0 : null === (u = p[e.selection]) || void 0 === u ? void 0 : null === (c = u.deep_link) || void 0 === c ? void 0 : c.desktop.split("?selectionIds=")[1], ",");
                            else if ("hardrockbet" === r) {
                                let t = e.filter(e => {
                                    var t, i, s, l, n;
                                    return null === (n = e.prop.apps) || void 0 === n ? void 0 : null === (l = n[r]) || void 0 === l ? void 0 : null === (s = l.outcomes) || void 0 === s ? void 0 : null === (i = s[e.selection]) || void 0 === i ? void 0 : null === (t = i.deep_link) || void 0 === t ? void 0 : t.ios
                                });
                                console.log(N = "https://share.hardrock.bet/Pt0T/bet?deep_link_value=hardrock://betslip/".concat(t.map(e => {
                                    var t, r, i, s, l;
                                    return null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.hardrockbet) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.ios.split("?deep_link_value=hardrock://betslip/")[1]
                                }).join(",")))
                            } else if ("betmgm" === r) {
                                let e = [i, ...s],
                                    t = null === (y = e[0].prop.apps) || void 0 === y ? void 0 : null === (w = y.betmgm) || void 0 === w ? void 0 : null === (j = w.outcomes) || void 0 === j ? void 0 : null === (b = j[e[0].selection]) || void 0 === b ? void 0 : null === (v = b.deep_link) || void 0 === v ? void 0 : v.desktop.split("/events/")[1].split("?")[0],
                                    r = e.map(e => {
                                        var t, r, i, s, l;
                                        return null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.betmgm) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.desktop.split("?options=")[1].split("&")[0]
                                    }).join(",");
                                N = "https://sports.betmgm.com/en/sports/events/".concat(t, "?options=").concat(r)
                            } else if ("novig" === r) {
                                let e = [i, ...s].map(e => {
                                    var t, r, i, s, l;
                                    return null === (l = e.prop.apps) || void 0 === l ? void 0 : null === (s = l.novig) || void 0 === s ? void 0 : null === (i = s.outcomes) || void 0 === i ? void 0 : null === (r = i[e.selection]) || void 0 === r ? void 0 : null === (t = r.deep_link) || void 0 === t ? void 0 : t.desktop.split("/events/")[1].split("/")[0]
                                });
                                N = "https://novig.com/events/".concat(e.join(","), "/pickfinder")
                            }
                        }
                    }
                    N = (null == N ? void 0 : N.replace("/oddsjam", "/pickfinder")) || "", !t && N ? (h(N), g(r), m(!0)) : N && window.open(N, "_blank")
                };
                return (0, i.jsxs)(i.Fragment, {
                    children: [(0, i.jsx)("div", {
                        className: "flex flex-col gap-2 overflow-y-auto",
                        children: e[0] ? e.filter(e => e.prop.apps).map(e => (0, i.jsx)(en, {
                            favorite: e
                        }, e.id)) : (0, i.jsxs)("div", {
                            className: "flex flex-col justify-evenly items-center p-3 py-3.5 bg-none border border-dashed border-input-bg rounded-2xl",
                            children: [(0, i.jsx)(E.Z, {
                                className: "w-8 h-8 mx-1 text-foreground inline-block"
                            }), (0, i.jsx)("p", {
                                className: "text-xs text-nowrap text-center flex items-center text-muted-foreground justify-center mt-2",
                                children: "Click on the star icon to add a"
                            }), (0, i.jsx)("p", {
                                className: "text-xs text-nowrap text-center flex items-center text-muted-foreground justify-center",
                                children: "prop to your Pick Builder"
                            })]
                        })
                    }), e[0] && (0, i.jsx)("div", {
                        className: "flex flex-col gap-2",
                        children: (0, i.jsx)("div", {
                            className: "flex justify-center mt-1 gap-2",
                            children: (0, i.jsxs)(ee.h_, {
                                children: [(0, i.jsx)(ee.$F, {
                                    asChild: !0,
                                    children: (0, i.jsxs)("button", {
                                        className: "overflow-hidden select-none outline-none w-full purple-button h-12 text-nowrap !text-xs flex justify-center font-semibold items-center gap-2",
                                        children: ["Export", (0, i.jsxs)("div", {
                                            className: "flex items-center -space-x-2",
                                            children: [(0, i.jsx)("div", {
                                                className: "w-7 h-7 rounded-full bg-gradient-to-b from-purple-500 to-purple-700 flex items-center justify-center ring-2 ring-input-bg/50 relative z-30",
                                                children: (0, i.jsx)(et.Z, {
                                                    appName: "prizepicks",
                                                    size: 16
                                                })
                                            }), (0, i.jsx)("div", {
                                                className: "w-7 h-7 rounded-full bg-[#2293fd] flex items-center justify-center ring-2 ring-input-bg/50 relative z-20",
                                                children: (0, i.jsx)(et.Z, {
                                                    appName: "fanduel",
                                                    size: 18
                                                })
                                            }), (0, i.jsx)("div", {
                                                className: "w-7 h-7 rounded-full bg-[#41cf45] flex items-center justify-center ring-2 ring-input-bg/50 relative z-10",
                                                children: (0, i.jsx)(et.Z, {
                                                    appName: "draftkings",
                                                    size: 20
                                                })
                                            })]
                                        }), (0, i.jsx)(T.Z, {
                                            className: "w-4 h-4 ml-1"
                                        })]
                                    })
                                }), (0, i.jsxs)(ee.AW, {
                                    align: "center",
                                    className: "w-56 !rounded-2xl p-2 border-2 border-purple-500/20 bg-gradient-to-b from-input-bg/95 to-input-bg backdrop-blur-lg shadow-xl",
                                    children: [(0, i.jsx)(ee.Xi, {
                                        disabled: 0 === r,
                                        onClick: () => w("prizepicks"),
                                        className: "cursor-pointer !rounded-xl hover:bg-purple-500/10 focus:bg-purple-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "prizepicks",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "PrizePicks"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [r > 0 ? "".concat(r, " pick").concat(r > 1 ? "s" : "") : "None", r > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === l,
                                        onClick: () => w("fanduel"),
                                        className: "cursor-pointer !rounded-xl hover:bg-blue-500/10 focus:bg-blue-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "fanduel",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "FanDuel"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [l > 0 ? "".concat(l, " pick").concat(l > 1 ? "s" : "") : "None", l > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === n,
                                        onClick: () => w("draftkings"),
                                        className: "cursor-pointer !rounded-xl hover:bg-green-500/10 focus:bg-green-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "draftkings",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "DraftKings"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [n > 0 ? "".concat(n, " pick").concat(n > 1 ? "s" : "") : "None", n > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === a,
                                        onClick: () => w("sleeper"),
                                        className: "cursor-pointer !rounded-xl hover:bg-cyan-500/10 focus:bg-cyan-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "sleeper",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "Sleeper"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [a > 0 ? "".concat(a, " pick").concat(a > 1 ? "s" : "") : "None", a > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === o,
                                        onClick: () => w("caesars"),
                                        className: "cursor-pointer !rounded-xl hover:bg-yellow-500/10 focus:bg-yellow-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "caesars",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "Caesars"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [o > 0 ? "".concat(o, " pick").concat(o > 1 ? "s" : "") : "None", o > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === d,
                                        onClick: () => w("hardrockbet"),
                                        className: "cursor-pointer !rounded-xl hover:bg-violet-500/10 focus:bg-violet-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "hardrockbet",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "HardRock"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [d > 0 ? "".concat(d, " pick").concat(d > 1 ? "s" : "") : "None", d > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === p,
                                        onClick: () => w("novig"),
                                        className: "cursor-pointer !rounded-xl hover:bg-blue-500/10 focus:bg-blue-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "novig",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "Novig"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [p > 0 ? "".concat(p, " pick").concat(p > 1 ? "s" : "") : "None", p > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    }), (0, i.jsx)(ee.Xi, {
                                        disabled: 0 === u,
                                        onClick: () => w("betmgm"),
                                        className: "cursor-pointer !rounded-xl hover:bg-amber-500/10 focus:bg-amber-500/15 py-2.5 px-3 transition-all",
                                        children: (0, i.jsxs)("div", {
                                            className: "flex items-center gap-2 w-full",
                                            children: [(0, i.jsx)(et.Z, {
                                                appName: "betmgm",
                                                size: 20
                                            }), (0, i.jsx)("span", {
                                                className: "flex-1",
                                                children: "BetMGM"
                                            }), (0, i.jsxs)("span", {
                                                className: "text-xs text-muted-foreground flex items-center gap-1",
                                                children: [u > 0 ? "".concat(u, " pick").concat(u > 1 ? "s" : "") : "None", u > 0 && (0, i.jsx)(D.Z, {
                                                    className: "w-3 h-3"
                                                })]
                                            })]
                                        })
                                    })]
                                })]
                            })
                        })
                    }), (0, i.jsx)(Y.Vq, {
                        open: f,
                        onOpenChange: e => {
                            m(e), e || j(!1)
                        },
                        children: (0, i.jsxs)(Y.cZ, {
                            className: "max-w-sm p-6 gap-0",
                            style: {
                                borderColor: ei[v].primary + "40"
                            },
                            onOpenAutoFocus: e => e.preventDefault(),
                            children: [(0, i.jsxs)("div", {
                                className: "flex items-center gap-3 mb-6",
                                children: [(0, i.jsx)("div", {
                                    className: "w-12 h-12 rounded-full bg-gradient-to-b ".concat(ei[v].gradient, " flex items-center justify-center"),
                                    children: (0, i.jsx)(et.Z, {
                                        appName: v,
                                        size: 28
                                    })
                                }), (0, i.jsxs)("div", {
                                    children: [(0, i.jsx)("h3", {
                                        className: "text-lg font-bold text-foreground",
                                        children: ei[v].name
                                    }), (0, i.jsx)("p", {
                                        className: "text-sm text-muted-foreground",
                                        children: "Scan to open on phone"
                                    })]
                                })]
                            }), (0, i.jsx)("div", {
                                className: "flex justify-center mb-6 bg-white p-6 rounded-2xl",
                                children: (0, i.jsx)(G.t, {
                                    value: x,
                                    size: 220,
                                    level: "M",
                                    fgColor: ei[v].qrColor,
                                    bgColor: "#ffffff"
                                })
                            }), (0, i.jsxs)("div", {
                                className: "flex gap-2 items-center",
                                children: [(0, i.jsx)("a", {
                                    href: x,
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    onClick: () => m(!1),
                                    className: "flex-1 min-w-0 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] bg-gradient-to-b ".concat(ei[v].gradient, " shadow-lg flex items-center justify-center text-center"),
                                    style: {
                                        boxShadow: "0 10px 30px -10px ".concat(ei[v].primary, "60")
                                    },
                                    children: "Open in Browser"
                                }), (0, i.jsx)("button", {
                                    type: "button",
                                    onMouseDown: e => e.preventDefault(),
                                    onClick: () => {
                                        navigator.clipboard.writeText(x).then(() => {
                                            j(!0), window.setTimeout(() => j(!1), 2e3)
                                        })
                                    },
                                    className: (0, Z.Z)("aspect-square shrink-0 h-[3rem] rounded-xl border bg-input-bg/60 text-muted-foreground shadow-none ring-0 flex items-center justify-center transition-colors", "hover:bg-input-bg hover:text-slate-200 active:bg-input-bg/80", "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0", b && "text-emerald-400 bg-emerald-500/[0.08]"),
                                    style: {
                                        borderColor: ei[v].primary + "40"
                                    },
                                    "aria-label": b ? "Copied" : "Copy link",
                                    children: b ? (0, i.jsx)(B.Z, {
                                        className: "h-[1.125rem] w-[1.125rem] stroke-[2.25]",
                                        "aria-hidden": !0
                                    }) : (0, i.jsx)(I.Z, {
                                        className: "h-[1.125rem] w-[1.125rem] stroke-[2.25]",
                                        "aria-hidden": !0
                                    })
                                })]
                            })]
                        })
                    })]
                })
            }
            let el = e => {
                let {
                    props: t
                } = e;
                return (0, i.jsxs)("svg", {
                    width: "16",
                    height: "16",
                    viewBox: "0 0 16 16",
                    fill: "none",
                    xmlns: "http://www.w3.org/2000/svg",
                    ...t,
                    children: [(0, i.jsx)("path", {
                        opacity: "0.4",
                        d: "M2.8622 5.00472L4.8395 4.83911L6.03218 6.03179L11.1012 11.1009L12.8305 12.8301C12.9779 14.2243 11.3794 15.1991 10.1941 14.3421L8.00021 12.7558L5.80623 14.3421C4.56719 15.238 2.87651 14.132 3.20098 12.6379L3.84318 9.68039L1.8812 7.89972C0.802475 6.92072 1.41052 5.1263 2.8622 5.00472Z",
                        fill: "#6F7280"
                    }), (0, i.jsx)("path", {
                        d: "M4.8395 4.83911L2.8622 5.00472C1.41052 5.1263 0.802475 6.92072 1.8812 7.89972L3.84318 9.68039L3.20098 12.6379C2.87651 14.132 4.56719 15.238 5.80624 14.3421L8.00021 12.7558L10.1941 14.3421C11.3794 15.1991 12.9779 14.2243 12.8305 12.8301L11.1012 11.1009L11.4964 12.9208C11.5613 13.2196 11.2232 13.4408 10.9754 13.2617L8.58614 11.5341C8.23641 11.2812 7.76394 11.2812 7.41428 11.5341L5.025 13.2617C4.77718 13.4408 4.43905 13.2196 4.50394 12.9208L5.18701 9.77518C5.26286 9.42592 5.14651 9.06265 4.88184 8.82245L2.77728 6.91238C2.56154 6.71658 2.68314 6.35772 2.97348 6.3334L5.73944 6.10174C5.84156 6.09318 5.94005 6.06921 6.03218 6.03179L4.8395 4.83911Z",
                        fill: "#6F7280"
                    }), (0, i.jsx)("path", {
                        fillRule: "evenodd",
                        clipRule: "evenodd",
                        d: "M6.46602 2.34567C7.04096 0.99236 8.95903 0.99236 9.53396 2.34567L10.5724 4.78997L13.138 5.00485C14.5896 5.12643 15.1976 6.92083 14.119 7.89983L12.9826 8.93116C12.71 9.17863 12.2884 9.15816 12.041 8.88556C11.7935 8.61289 11.8139 8.19129 12.0866 7.94383L13.2228 6.91249C13.4386 6.71669 13.317 6.35784 13.0266 6.33353L10.2608 6.10187C9.89103 6.0709 9.5689 5.83781 9.42383 5.49636L8.30683 2.86702C8.19183 2.59635 7.80816 2.59636 7.69323 2.86702L7.55556 3.19097C7.41163 3.52985 7.02016 3.68786 6.6813 3.54389C6.34243 3.39993 6.18443 3.00851 6.32839 2.66963L6.46602 2.34567Z",
                        fill: "#6F7280"
                    }), (0, i.jsx)("path", {
                        fillRule: "evenodd",
                        clipRule: "evenodd",
                        d: "M1.52863 1.52863C1.78899 1.26829 2.21109 1.26829 2.47145 1.52863L14.4714 13.5286C14.7318 13.789 14.7318 14.2111 14.4714 14.4714C14.2111 14.7318 13.789 14.7318 13.5286 14.4714L1.52863 2.47145C1.26829 2.21109 1.26829 1.78899 1.52863 1.52863Z",
                        fill: "#6F7280"
                    })]
                })
            };

            function en(e) {
                var t;
                let {
                    favorite: r
                } = e, [l, n] = (0, c.useState)("");
                (0, c.useEffect)(() => {
                    if (!r.prop.start_date) return;
                    let e = () => {
                        let e = X()(),
                            t = X()(r.prop.start_date).diff(e);
                        if (t <= 0) {
                            n("Starting now");
                            return
                        }
                        let i = X().duration(t),
                            s = Math.floor(i.asDays()),
                            l = i.hours(),
                            a = i.minutes(),
                            o = "";
                        s > 0 && (o += "".concat(s, "d ")), (l > 0 || s > 0) && (o += "".concat(l, "h ")), (a > 0 || l > 0 || s > 0) && (o += "".concat(a, "m")), n(o)
                    };
                    e();
                    let t = setInterval(e, 1e3);
                    return () => clearInterval(t)
                }, [r.prop.start_date]);
                let {
                    removeFavorite: a,
                    updateFavorite: o,
                    favoritesLoading: u
                } = (0, s.r)(), [p, f] = (0, q.J)();
                return (0, i.jsxs)("div", {
                    className: "flex flex-col p-2 px-3 gap-2.5 bg-gradient-to-br from-input-bg/80 to-input-bg/40 rounded-2xl border border-white/5 shadow-lg backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300",
                    children: [(0, i.jsx)("div", {
                        className: "flex justify-between w-full",
                        children: (0, i.jsx)("div", {
                            className: "flex items-center w-full space-x-2",
                            children: (0, i.jsxs)("div", {
                                className: "flex flex-col gap-1.5 w-full",
                                children: [(0, i.jsx)("div", {
                                    className: "flex w-full items-center gap-1",
                                    children: (0, i.jsxs)("div", {
                                        className: "flex items-start gap-1.5 w-full min-w-0",
                                        children: [(0, i.jsxs)("div", {
                                            className: "relative flex-shrink-0",
                                            children: [(0, i.jsx)(J.A, {
                                                playerId: r.prop.player_id,
                                                playerName: r.prop.player_name,
                                                sport: r.prop.sport,
                                                imageUrl: r.prop.player_image,
                                                size: 34,
                                                className: "border border-slate-600/50"
                                            }), (0, i.jsx)($.C, {
                                                sport: r.prop.sport,
                                                trim: !0,
                                                overlay: !0
                                            })]
                                        }), (0, i.jsxs)("div", {
                                            className: "flex flex-col w-full -space-y-0.5 mb-1 min-w-0",
                                            children: [(0, i.jsxs)("div", {
                                                className: "flex items-center gap-1.5 w-full min-w-0",
                                                children: [(0, i.jsxs)("div", {
                                                    className: "flex items-center gap-1.5 min-w-0 flex-1 mb-1",
                                                    children: [(0, i.jsx)(d.default, {
                                                        href: "/players/".concat(r.prop.sport, "/").concat(r.prop.player_id, "?from=props&prop=").concat(encodeURIComponent(r.prop.groupKey)),
                                                        className: "text-xs truncate hover:text-purple-400 transition-colors",
                                                        prefetch: !1,
                                                        children: r.prop.player_name
                                                    }), (null === (t = r.prop.team) || void 0 === t ? void 0 : t.abbreviation) && "tennis" !== r.prop.sport && (0, i.jsx)("span", {
                                                        className: "bg-gradient-to-r from-blue-600/80 to-blue-700/80 rounded-lg px-2 py-0.5 text-primary text-xxs font-semibold shadow-sm border border-blue-500/20 flex-shrink-0",
                                                        children: r.prop.team.abbreviation
                                                    })]
                                                }), (0, i.jsx)("div", {
                                                    className: "flex flex-col items-start flex-shrink-0 cursor-pointer",
                                                    children: u ? (0, i.jsx)(U.Z, {
                                                        className: "w-4 h-4 animate-spin text-purple-400"
                                                    }) : (0, i.jsx)("button", {
                                                        type: "button",
                                                        onClick: () => a(r.prop.groupKey),
                                                        className: "text-slate-400 hover:text-purple-400 transition-colors hover:bg-white/5 rounded-lg",
                                                        "aria-label": "Remove favorite",
                                                        children: (0, i.jsx)(el, {
                                                            className: "w-4 h-4"
                                                        })
                                                    })
                                                })]
                                            }), (0, i.jsxs)("p", {
                                                className: "text-xs text-muted-foreground truncate whitespace-nowrap min-w-0",
                                                children: [(0, i.jsxs)("span", {
                                                    className: "font-semibold text-primary",
                                                    children: [r.prop.line, " "]
                                                }), r.prop.stat]
                                            })]
                                        })]
                                    })
                                }), (0, i.jsxs)("div", {
                                    className: "flex items-center gap-1.5 flex-wrap",
                                    children: [(0, i.jsx)(er.E, {
                                        prop: r.prop,
                                        appsOrder: p,
                                        size: 18,
                                        count: 2,
                                        hideModifiers: !1
                                    }), r.prop.start_date && (0, i.jsx)(Q.pn, {
                                        delayDuration: 300,
                                        children: (0, i.jsxs)(Q.u, {
                                            children: [(0, i.jsx)(Q.aJ, {
                                                asChild: !0,
                                                children: (0, i.jsx)("p", {
                                                    className: "text-xs inline-flex gap-1 items-center text-primary ml-auto -mt-0.5 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 cursor-pointer",
                                                    children: (0, i.jsxs)("span", {
                                                        className: "text-yellow-400 inline-flex items-center gap-1 font-semibold",
                                                        children: [(0, i.jsx)(W.Z, {
                                                            size: 12
                                                        }), (() => {
                                                            let e = X()(r.prop.start_date);
                                                            return 6 >= Math.abs(e.diff(X()(), "hours", !0)) ? e.fromNow() : e.format(0 === e.minutes() ? "ddd  h A" : "ddd h:mm A")
                                                        })()]
                                                    })
                                                })
                                            }), (0, i.jsx)(Q._v, {
                                                className: "bg-slate-900 border-yellow-500/30 text-yellow-400 text-xs font-medium",
                                                children: X()(r.prop.start_date).format("ddd, MMM D [at] h:mm A")
                                            })]
                                        })
                                    })]
                                })]
                            })
                        })
                    }), (0, i.jsxs)("div", {
                        className: "grid grid-cols-2 text-sm gap-2",
                        children: [(0, i.jsxs)("button", {
                            onClick: () => {
                                r.selection = "under", o(r)
                            },
                            className: (0, Z.Z)("w-full text-primary transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-1.5", "under" === r.selection ? "under-button shadow-lg shadow-red-500/20" : "neutral-button hover:bg-[#2a2e45]"),
                            children: [(0, i.jsx)(V.Z, {
                                className: "w-3.5 h-3.5"
                            }), "Under"]
                        }), (0, i.jsxs)("button", {
                            onClick: () => {
                                r.selection = "over", o(r)
                            },
                            className: (0, Z.Z)("w-full text-primary transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-1.5", "over" === r.selection ? "over-button shadow-lg shadow-blue-500/20" : "neutral-button hover:bg-[#2a2e45]"),
                            children: [(0, i.jsx)(y.Z, {
                                className: "w-3.5 h-3.5"
                            }), "Over"]
                        })]
                    })]
                }, r.prop.groupKey)
            }
            var ea = r(55904);

            function eo(e) {
                let { ...t
                } = e, {
                    sport: r
                } = (0, P.useParams)(), l = (0, P.usePathname)(), {
                    state: n,
                    openMobile: o,
                    isMobile: d
                } = (0, a.Ap)(), {
                    favorites: c,
                    removeFavorite: u
                } = (0, s.r)(), {
                    state: p,
                    mounted: m,
                    isLoaded: x
                } = (0, M.sx)(), {
                    openProGate: h
                } = (0, M.An)(), _ = m && x && (f.gT || "Admin" === p.plan), F = f.gT && !p.hasPro, L = e => F ? {
                    onClick: () => h("sidebar_".concat(e)),
                    title: "Pro feature"
                } : void 0, S = {
                    navMain: [{
                        title: f.gT ? "Premium" : "Analysis",
                        items: [{
                            title: "Props",
                            url: "/props",
                            icon: g.Z,
                            isActive: l.startsWith("/props")
                        }, {
                            title: "Popular",
                            url: "/popular",
                            icon: b.Z,
                            isActive: l.startsWith("/popular")
                        }, {
                            title: "Discrepancies",
                            url: "/discrepancies",
                            icon: j.Z,
                            isActive: l.startsWith("/discrepancies")
                        }, {
                            title: "Players",
                            url: "/players",
                            icon: w.Z,
                            isActive: l.startsWith("/players")
                        }]
                    }, ..._ ? [{
                        title: "Pro",
                        labelAddon: f.gT ? (0, i.jsx)(z, {}) : void 0,
                        items: [{
                            title: "EV+",
                            url: "/positive-ev",
                            icon: y.Z,
                            isActive: l.startsWith("/positive-ev"),
                            locked: L("positive_ev")
                        }, {
                            title: "Arbitrage",
                            url: "/arbitrage",
                            icon: N.Z,
                            isActive: l.startsWith("/arbitrage"),
                            locked: L("arbitrage")
                        }, {
                            title: "Middles",
                            url: "/middles",
                            icon: k.Z,
                            isActive: l.startsWith("/middles"),
                            locked: L("middles")
                        }]
                    }] : []]
                };
                return (0, i.jsxs)(a.DD, {
                    collapsible: "icon",
                    ...t,
                    children: [(0, i.jsx)(a.$l, {
                        children: (0, i.jsx)(A, {})
                    }), (0, i.jsx)(a.TZ, {
                        children: (0, i.jsxs)(ea.x, {
                            children: [S.navMain.map((e, t) => (0, i.jsx)(v, {
                                section: e
                            }, t)), ("collapsed" !== n || o && d) && (0, i.jsxs)(a.Hz, {
                                children: [(0, i.jsxs)(a.nO, {
                                    className: "justify-between gap-2",
                                    children: [(0, i.jsx)("span", {
                                        children: "Pick Builder"
                                    }), c.length > 0 && (0, i.jsxs)("button", {
                                        type: "button",
                                        className: "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300",
                                        onClick: () => {
                                            c.forEach(e => {
                                                u(e.prop.groupKey)
                                            })
                                        },
                                        children: [(0, i.jsx)(C.Z, {
                                            className: "!size-3",
                                            "aria-hidden": !0
                                        }), "Clear ", c.length]
                                    })]
                                }), (0, i.jsx)(a.Ks, {
                                    children: (0, i.jsx)("div", {
                                        className: "flex flex-col gap-1 px-0.5",
                                        children: (0, i.jsx)(es, {})
                                    })
                                })]
                            })]
                        })
                    }), (0, i.jsx)(a.ZW, {
                        children: (0, i.jsx)(O, {})
                    }), (0, i.jsx)(a.wJ, {})]
                })
            }
            var ed = r(77606),
                ec = r(90070),
                eu = r(69948);
            let ep = {
                free: 0,
                paid: 1,
                pro: 2
            };

            function ef() {
                var e;
                let {
                    user: t,
                    isLoaded: r
                } = (0, u.aF)(), {
                    getToken: i
                } = (0, eu.y)(), s = (0, c.useRef)(!1), l = (0, c.useRef)(0), n = (0, c.useRef)(null), a = function(e) {
                    let t = (0, f.nt)(null == e ? void 0 : e.plan);
                    return t && (0, f.QS)(e) ? "pro" : t ? "paid" : "free"
                }(null !== (e = null == t ? void 0 : t.publicMetadata) && void 0 !== e ? e : null), o = "pro" === a;
                return (0, c.useEffect)(() => {
                    if (!r || !t || o) return;
                    let e = !1,
                        i = async () => {
                            if (e) return;
                            let r = Date.now();
                            if (!(r - l.current < 3e3)) {
                                l.current = r;
                                try {
                                    await t.reload()
                                } catch (e) {}
                            }
                        },
                        s = () => {
                            "visible" === document.visibilityState && i()
                        };
                    return document.addEventListener("visibilitychange", s), window.addEventListener("focus", i), i(), () => {
                        e = !0, document.removeEventListener("visibilitychange", s), window.removeEventListener("focus", i)
                    }
                }, [r, t, o]), (0, c.useEffect)(() => {
                    if (r && t) {
                        if (null === n.current) {
                            n.current = a;
                            return
                        }
                        ep[a] > ep[n.current] && !s.current && (s.current = !0, (async () => {
                            await i({
                                skipCache: !0
                            }).catch(() => void 0), window.location.reload()
                        })()), n.current = a
                    }
                }, [r, t, a, i]), null
            }
            let em = (0, r(48135).default)(() => Promise.all([r.e(8161), r.e(4169)]).then(r.bind(r, 44169)).then(e => e.MobileTabSwitcher), {
                loadableGenerated: {
                    webpack: () => [44169]
                },
                ssr: !1
            });

            function ex(e) {
                let {
                    children: t,
                    defaultOpen: r,
                    sportDynamics: o
                } = e;
                return (0, i.jsx)(n.b, {
                    value: o,
                    children: (0, i.jsxs)("div", {
                        className: "max-w-[1700px] mx-auto w-full flex min-w-0",
                        style: {
                            "--layout-offset": "max(0px, calc((100vw - 1700px)/2))"
                        },
                        children: [(0, i.jsx)(ef, {}), (0, i.jsx)(M.D3, {
                            children: (0, i.jsx)(a.Hn, {
                                defaultOpen: r,
                                children: (0, i.jsxs)(s.c, {
                                    children: [(0, i.jsx)(eo, {}), (0, i.jsx)(l.Wy, {
                                        children: (0, i.jsx)(ed.I, {
                                            children: (0, i.jsxs)("div", {
                                                className: "overflow-hidden overscroll-none h-[calc(100dvh)] flex-1 flex flex-col dashboard dashboard-no-image-select select-none mmlg:select-text bg-transparent",
                                                children: [(0, i.jsx)(ec.default, {}), (0, i.jsx)("div", {
                                                    className: "flex-grow overflow-auto",
                                                    children: t
                                                }), (0, i.jsx)("div", {
                                                    className: "md:hidden bg-card-bg",
                                                    children: (0, i.jsx)(em, {})
                                                })]
                                            })
                                        })
                                    })]
                                })
                            })
                        })]
                    })
                })
            }
        },
        90070: function(e, t, r) {
            "use strict";

            function i() {
                return null
            }
            r.d(t, {
                default: function() {
                    return i
                }
            }), r(10131), r(76840)
        },
        54586: function(e, t, r) {
            "use strict";
            r.d(t, {
                W: function() {
                    return d
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(63855),
                n = r(28876),
                a = r(68886),
                o = r(58685);

            function d(e) {
                let {
                    children: t,
                    contentClassName: r,
                    open: d,
                    onOpenChange: c,
                    title: u = "PickFinder Pro Video Guide",
                    description: p = "A full walkthrough of Arbitrage, Middles and EV+ — how each Pro tool works and how to use them to find profitable bets."
                } = e, [f, m] = (0, s.useState)(!1), {
                    openProGate: x
                } = (0, a.An)(), {
                    state: h
                } = (0, a.sx)();
                return (0, i.jsxs)(l.Vq, {
                    open: null != d ? d : f,
                    onOpenChange: e => {
                        void 0 === d && m(e), null == c || c(e), e || !n.gT || h.hasPro || x("video_guide")
                    },
                    children: [t ? (0, i.jsx)(l.hg, {
                        asChild: !0,
                        children: t
                    }) : null, (0, i.jsxs)(l.cZ, {
                        className: (0, o.cn)("sm:max-w-[700px]", r),
                        children: [(0, i.jsxs)(l.fK, {
                            children: [(0, i.jsx)(l.$N, {
                                children: u
                            }), (0, i.jsx)(l.Be, {
                                children: p
                            })]
                        }), (0, i.jsx)("div", {
                            className: "grid h-full w-full gap-4 py-4",
                            children: (0, i.jsx)("iframe", {
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
        29562: function(e, t, r) {
            "use strict";
            r.d(t, {
                E: function() {
                    return o
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(47288),
                n = r(51465),
                a = r(63210);
            let o = (0, s.memo)(function(e) {
                let {
                    prop: t,
                    appsOrder: r,
                    maxModifiers: o,
                    forceRow: d,
                    hideModifiers: c,
                    count: u,
                    apps: p,
                    size: f,
                    inSelect: m,
                    outcomesClassName: x
                } = e, h = p || (null == t ? void 0 : t.apps), [v, g] = (0, s.useState)(!1);
                if ((0, s.useEffect)(() => g(!0), []), !h) return null;
                let [b, j] = (0, s.useState)(!1), w = u || 3, y = r.filter(e => h[e]);
                y.slice(0, w);
                let N = y.slice(w);
                return (0, i.jsxs)("div", {
                    className: "flex items-center",
                    children: [(0, i.jsx)("div", {
                        className: (0, a.Z)("flex items-center", !c && " divide-x divide-gray-700"),
                        children: v && y.slice(0, w).map((e, t) => {
                            let r = h[e];
                            return (0, i.jsx)("div", {
                                className: (0, a.Z)("first:pl-0 last:pr-0", c ? "px-0.5" : "px-2"),
                                children: (0, i.jsx)(l.Z, {
                                    appName: e,
                                    outcomes: c || o && t >= o ? void 0 : r.outcomes,
                                    outcomesClassName: x,
                                    size: f || (c ? 20 : 24),
                                    forceRow: d
                                })
                            }, e)
                        })
                    }), v && N.length > 0 && (m ? (0, i.jsxs)("div", {
                        "data-row-click-ignore": "true",
                        className: "cursor-pointer ml-2 h-6 border border-input px-2 bg-gradient-to-b from-highlight to-highlight/40 rounded-full flex items-center justify-center",
                        children: [(0, i.jsxs)("span", {
                            className: "text-xs font-medium text-gray-600 dark:text-gray-400",
                            children: ["+", N.length]
                        }), (0, i.jsxs)("span", {
                            className: "sr-only",
                            children: ["Show ", N.length, " more apps"]
                        })]
                    }) : (0, i.jsxs)(n.J2, {
                        open: b,
                        onOpenChange: j,
                        children: [(0, i.jsx)(n.xo, {
                            asChild: !0,
                            children: (0, i.jsxs)("div", {
                                "data-row-click-ignore": "true",
                                className: "cursor-pointer ml-2 h-6 border border-input px-2 bg-gradient-to-b from-highlight to-highlight/40 rounded-full flex items-center justify-center",
                                children: [(0, i.jsxs)("span", {
                                    className: "text-xs font-medium text-gray-600 dark:text-gray-400",
                                    children: ["+", N.length]
                                }), (0, i.jsxs)("span", {
                                    className: "sr-only",
                                    children: ["Show ", N.length, " more apps"]
                                })]
                            })
                        }), (0, i.jsx)(n.yk, {
                            className: "w-auto bg-card-bg p-4",
                            align: "start",
                            children: (0, i.jsx)("div", {
                                className: "flex flex-wrap gap-4 max-w-80",
                                children: N.map(e => {
                                    let t = h[e];
                                    return (0, i.jsx)("div", {
                                        className: "first:pl-0 last:pr-0",
                                        children: (0, i.jsx)(l.Z, {
                                            appName: e,
                                            outcomes: c ? void 0 : t.outcomes,
                                            outcomesClassName: x,
                                            size: 24
                                        })
                                    }, e)
                                })
                            })
                        })]
                    }))]
                })
            })
        },
        46434: function(e, t, r) {
            "use strict";
            r.d(t, {
                $F: function() {
                    return d
                },
                AW: function() {
                    return c
                },
                Ju: function() {
                    return p
                },
                VD: function() {
                    return f
                },
                Xi: function() {
                    return u
                },
                h_: function() {
                    return o
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(55950),
                n = r(2663),
                a = r(58685);
            let o = l.fC,
                d = l.xz;
            l.ZA, l.Uv, l.Tr, l.Ee, s.forwardRef((e, t) => {
                let {
                    className: r,
                    inset: s,
                    children: o,
                    ...d
                } = e;
                return (0, i.jsxs)(l.fF, {
                    ref: t,
                    className: (0, a.cn)("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent", s && "pl-8", r),
                    ...d,
                    children: [o, (0, i.jsx)(n.XCv, {
                        className: "ml-auto h-4 w-4"
                    })]
                })
            }).displayName = l.fF.displayName, s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, i.jsx)(l.tu, {
                    ref: t,
                    className: (0, a.cn)("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", r),
                    ...s
                })
            }).displayName = l.tu.displayName;
            let c = s.forwardRef((e, t) => {
                let {
                    className: r,
                    sideOffset: s = 4,
                    ...n
                } = e;
                return (0, i.jsx)(l.Uv, {
                    children: (0, i.jsx)(l.VY, {
                        ref: t,
                        sideOffset: s,
                        className: (0, a.cn)("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-input-bg border-input-border p-1 text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", r),
                        ...n
                    })
                })
            });
            c.displayName = l.VY.displayName;
            let u = s.forwardRef((e, t) => {
                let {
                    className: r,
                    inset: s,
                    ...n
                } = e;
                return (0, i.jsx)(l.ck, {
                    ref: t,
                    className: (0, a.cn)("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-slate-700/40 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", s && "pl-8", r),
                    ...n
                })
            });
            u.displayName = l.ck.displayName, s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    checked: o,
                    ...d
                } = e;
                return (0, i.jsxs)(l.oC, {
                    ref: t,
                    className: (0, a.cn)("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", r),
                    checked: o,
                    ...d,
                    children: [(0, i.jsx)("span", {
                        className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                        children: (0, i.jsx)(l.wU, {
                            children: (0, i.jsx)(n.nQG, {
                                className: "h-4 w-4"
                            })
                        })
                    }), s]
                })
            }).displayName = l.oC.displayName, s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    ...o
                } = e;
                return (0, i.jsxs)(l.Rk, {
                    ref: t,
                    className: (0, a.cn)("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", r),
                    ...o,
                    children: [(0, i.jsx)("span", {
                        className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                        children: (0, i.jsx)(l.wU, {
                            children: (0, i.jsx)(n.jXb, {
                                className: "h-4 w-4 fill-current"
                            })
                        })
                    }), s]
                })
            }).displayName = l.Rk.displayName;
            let p = s.forwardRef((e, t) => {
                let {
                    className: r,
                    inset: s,
                    ...n
                } = e;
                return (0, i.jsx)(l.__, {
                    ref: t,
                    className: (0, a.cn)("px-2 py-1.5 text-sm font-semibold !text-muted-foreground", s && "pl-8", r),
                    ...n
                })
            });
            p.displayName = l.__.displayName;
            let f = s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, i.jsx)(l.Z0, {
                    ref: t,
                    className: (0, a.cn)("-mx-1 my-1 h-px bg-muted", r),
                    ...s
                })
            });
            f.displayName = l.Z0.displayName
        },
        55904: function(e, t, r) {
            "use strict";
            r.d(t, {
                B: function() {
                    return o
                },
                x: function() {
                    return a
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(92864),
                n = r(58685);
            let a = s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    ...a
                } = e;
                return (0, i.jsxs)(l.fC, {
                    ref: t,
                    className: (0, n.cn)("relative overflow-hidden", r),
                    ...a,
                    children: [(0, i.jsx)(l.l_, {
                        className: "h-full w-full rounded-[inherit]",
                        children: s
                    }), (0, i.jsx)(o, {}), (0, i.jsx)(l.Ns, {})]
                })
            });
            a.displayName = l.fC.displayName;
            let o = s.forwardRef((e, t) => {
                let {
                    className: r,
                    orientation: s = "vertical",
                    ...a
                } = e;
                return (0, i.jsx)(l.gb, {
                    ref: t,
                    orientation: s,
                    className: (0, n.cn)("flex touch-none select-none transition-colors z-20", "vertical" === s && "h-full w-2.5 border-l border-l-transparent p-[1px]", "horizontal" === s && "h-2.5 flex-col border-t border-t-transparent p-[1px]", r),
                    ...a,
                    children: (0, i.jsx)(l.q4, {
                        className: "relative flex-1 rounded-full bg-border"
                    })
                })
            });
            o.displayName = l.gb.displayName
        },
        13881: function(e, t, r) {
            "use strict";
            r.d(t, {
                c: function() {
                    return y
                },
                r: function() {
                    return N
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(7357),
                n = r(69948),
                a = r(69237),
                o = r(6672),
                d = r(72044);
            async function c(e, t, r, i) {
                let s = "true" === d.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app",
                    l = await r(),
                    n = await fetch("".concat(s).concat(e), {
                        method: t,
                        headers: {
                            "Content-Type": "application/json",
                            ...l && {
                                Authorization: "Bearer ".concat(l)
                            }
                        },
                        body: i ? JSON.stringify(i) : void 0
                    }),
                    a = await n.json();
                if (200 !== n.status) throw Error(a.error || a.message || "An error occurred");
                return a
            }
            async function u(e, t, r) {
                return c("/props/favorites", "POST", r, {
                    prop_key: e.groupKey,
                    selection: t
                })
            }
            async function p(e, t) {
                return c("/props/favorites/".concat(e), "DELETE", t)
            }
            async function f(e, t) {
                return c("/props/favorites/".concat(e.id), "PATCH", t, {
                    selection: e.selection
                })
            }
            var m = r(38977),
                x = r(8933),
                h = r(28876),
                v = r(34772),
                g = r(59160),
                b = r(52924),
                j = r(72044);
            let w = (0, s.createContext)({}),
                y = e => {
                    var t;
                    let {
                        children: r
                    } = e, {
                        open: d,
                        openMobile: c,
                        isMobile: y,
                        toggleSidebar: N
                    } = (0, o.Ap)(), {
                        getToken: k
                    } = (0, n.y)(), C = "true" === j.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app", {
                        user: P,
                        isLoaded: _,
                        isSignedIn: A
                    } = (0, a.aF)(), {
                        isWebViewApp: F
                    } = (0, g.B)(), L = null == P ? void 0 : null === (t = P.publicMetadata) || void 0 === t ? void 0 : t.plan, S = (0, h.nt)(L), Z = S && (d && !y || c), [R, O] = (0, s.useState)(!1), {
                        data: M,
                        mutate: z
                    } = (0, m.Z)(S ? "".concat(C, "/props/favorites") : null, {
                        revalidateOnMount: !1,
                        revalidateOnFocus: !1,
                        revalidateOnReconnect: !1
                    }), E = (0, s.useRef)(!1), [T, D] = (0, s.useState)(!1);
                    (0, s.useEffect)(() => {
                        D(!0)
                    }, []), (0, s.useEffect)(() => {
                        var e;
                        if (!_ || !S) return;
                        let t = null == P ? void 0 : null === (e = P.unsafeMetadata) || void 0 === e ? void 0 : e.favorites,
                            r = void 0 !== t,
                            i = t && Object.keys(t).length > 0;
                        (!r || i) && Z && !E.current && T && (E.current = !0, z())
                    }, [d, c, _, P, z, T, S]), (0, s.useEffect)(() => {
                        var e, t;
                        if (!_ || !P || !S || void 0 === M) return;
                        let r = {};
                        for (let e of M) {
                            let t = e.prop.groupKey;
                            t && (r[t] = e.id)
                        }
                        let i = null !== (t = null === (e = P.unsafeMetadata) || void 0 === e ? void 0 : e.favorites) && void 0 !== t ? t : void 0;
                        i && Object.keys(i).length === Object.keys(r).length && Object.keys(r).every(e => i[e] === r[e]) || (P.update({
                            unsafeMetadata: { ...P.unsafeMetadata,
                                favorites: r
                            }
                        }), W(r))
                    }, [M, _, P, S]);
                    let [B, I] = (0, s.useState)(!1), [U, W] = (0, s.useState)({});
                    (0, s.useEffect)(() => {
                        if (_) {
                            var e;
                            W(S && (null == P ? void 0 : null === (e = P.unsafeMetadata) || void 0 === e ? void 0 : e.favorites) || {})
                        }
                    }, [_, P, S]);
                    let V = (0, s.useCallback)(() => {
                            let e = (0, v.cz)({
                                isSignedIn: A,
                                plan: L,
                                isPwa: F,
                                isWebView: F
                            });
                            v.co.trackFavoritePaywallTriggered({
                                source: "favorite",
                                featureName: "Pick Builder",
                                ...e
                            }), v.co.trackPickBuilderPaywallTriggered({
                                source: "pick_builder",
                                featureName: "Pick Builder",
                                ...e
                            })
                        }, [A, F, L]),
                        q = (0, s.useCallback)(() => !!_ && (!!P && !!S || (V(), O(!0), !1)), [S, _, V, P]),
                        K = (0, s.useCallback)(async (e, t) => {
                            if (!q()) return !1;
                            if (I(!0), U[e.groupKey]) return I(!1), !1;
                            if (Object.keys(U).length >= 50) return l.Am.warning("Maximum ".concat(50, " props allowed")), I(!1), !1;
                            try {
                                let r = await u(e, t, k);
                                z(function() {
                                    let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                    return [...e, r.favorite]
                                }, {
                                    revalidate: !1
                                }), l.Am.success("Added to your Pick Builder!");
                                let i = { ...U,
                                    [e.groupKey]: r.favorite.id
                                };
                                return W(i), await (null == P ? void 0 : P.update({
                                    unsafeMetadata: { ...null == P ? void 0 : P.unsafeMetadata,
                                        favorites: i
                                    }
                                })), y && N(), window.setTimeout(() => {
                                    (0, b.N)()
                                }, 1500), !0
                            } catch (e) {
                                return console.error(e), l.Am.error(e instanceof Error ? e.message : "Failed to add favorite"), !1
                            } finally {
                                I(!1)
                            }
                        }, [U, P, k, q, z, y, N]),
                        X = (0, s.useCallback)(async e => {
                            if (q()) {
                                I(!0);
                                try {
                                    let t = U[e];
                                    if (!t) {
                                        l.Am.error("Favorite not found");
                                        return
                                    }
                                    await p(t, k), z(function() {
                                        let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                        return e.filter(e => e.id !== t)
                                    }, {
                                        revalidate: !1
                                    });
                                    let {
                                        [e]: r, ...i
                                    } = U;
                                    W(i), await (null == P ? void 0 : P.update({
                                        unsafeMetadata: { ...null == P ? void 0 : P.unsafeMetadata,
                                            favorites: i
                                        }
                                    }))
                                } catch (e) {
                                    console.error(e), l.Am.error(e instanceof Error ? e.message : "Failed to remove favorite")
                                } finally {
                                    I(!1)
                                }
                            }
                        }, [U, P, k, q, z]),
                        G = (0, s.useCallback)(async e => {
                            if (q()) {
                                I(!0);
                                try {
                                    e.prop_key && !U[e.prop_key] && (null == P || P.update({
                                        unsafeMetadata: { ...null == P ? void 0 : P.unsafeMetadata,
                                            favorites: { ...U,
                                                [e.prop_key]: e.id
                                            }
                                        }
                                    })), await f(e, k), z(function() {
                                        let t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                        return t.map(t => t.id === e.id ? e : t)
                                    }, {
                                        revalidate: !1
                                    })
                                } catch (e) {
                                    console.error(e), l.Am.error(e instanceof Error ? e.message : "Failed to update favorite")
                                } finally {
                                    I(!1)
                                }
                            }
                        }, [U, P, k, q, z]);
                    return (0, i.jsxs)(w.Provider, {
                        value: {
                            favorites: S && M || [],
                            favoritesLoading: B,
                            favoriteIdToFavorite: S ? U : {},
                            addFavorite: K,
                            removeFavorite: X,
                            updateFavorite: G
                        },
                        children: [r, (0, i.jsx)(x.Ei, {
                            open: R,
                            onOpenChange: O,
                            featureName: "Pick Builder",
                            title: "Unlock Pick Builder",
                            description: "Favoriting props and building cards is a premium PickFinder feature.",
                            benefits: h.vR.pickBuilder,
                            source: "pick_builder"
                        })]
                    })
                },
                N = () => (0, s.useContext)(w)
        },
        36098: function(e, t, r) {
            "use strict";
            r.d(t, {
                RT: function() {
                    return d
                },
                Wy: function() {
                    return b
                },
                ir: function() {
                    return g
                },
                lW: function() {
                    return c
                },
                mN: function() {
                    return j
                },
                qi: function() {
                    return o
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(93630);
            let n = (0, s.createContext)({}),
                a = Object.keys(l.ZP),
                o = {
                    minOdds: "",
                    maxOdds: "",
                    oddsSource: "best",
                    oddsApp: "",
                    oddsSide: "either"
                },
                d = {
                    min: "",
                    max: "",
                    columns: []
                },
                c = {
                    playerRankMin: "",
                    playerRankMax: "",
                    rankDiffMin: "",
                    rankDiffMax: ""
                },
                u = "propsOddsFilter",
                p = "propsHitRateFilter",
                f = "propsAltLinesFilter",
                m = {
                    showAltLines: !1,
                    pushProps: "all"
                };

            function x(e, t) {
                try {
                    let r = window.localStorage.getItem(e);
                    if (!r) return t;
                    return JSON.parse(r)
                } catch (r) {
                    return console.warn('Error reading localStorage key "'.concat(e, '":'), r), t
                }
            }

            function h(e, t) {
                try {
                    window.localStorage.setItem(e, JSON.stringify(t))
                } catch (t) {
                    console.warn('Error writing localStorage key "'.concat(e, '":'), t)
                }
            }
            let v = () => ({
                    search: "",
                    games: [],
                    page: 1,
                    stats: [],
                    teams: [],
                    playerPage: 1,
                    playerSearch: "",
                    playerTeam: ""
                }),
                g = {
                    appsOrder: l.w$,
                    apps: l.w$,
                    sports: a,
                    modifiers: ["any", "goblin", "demon", "none", "udfixed", "dabblefixed", "sleepermain", "parlayplaymain", "betrfixed", "edge", "boost"],
                    date: void 0,
                    hitRateRange: {
                        min: 0,
                        max: 100
                    },
                    winChanceRange: "",
                    showAltLines: !1,
                    pushProps: "all",
                    appMap: {
                        prizepicks: "PrizePicks",
                        underdog: "Underdog",
                        fliff: "Fliff",
                        sleeper: "Sleeper",
                        dabble: "Dabble",
                        parlayplay: "ParlayPlay",
                        dkpick6: "DK Pick6",
                        draftkings: "DraftKings",
                        fanduel: "FanDuel",
                        pinnacle: "Pinnacle",
                        bovada: "BVDA",
                        betmgm: "BetMGM",
                        prophetx: "ProphetX",
                        novig: "Novig",
                        caesars: "Caesars",
                        betonlineag: "BOAG",
                        betrivers: "BetRivers",
                        bet365: "Bet365",
                        fanatics: "Fanatics",
                        rebet: "Rebet",
                        thunderpick: "ThunderPick",
                        hardrockbet: "Hard Rock",
                        betr: "Betr",
                        courtside: "Courtside",
                        kalshi: "Kalshi",
                        polymarket: "Polymarket",
                        robinhood: "Robinhood"
                    },
                    sort: ["-hitRateLast10"],
                    sortDiscrepancies: "-diffPercent",
                    oddsFilter: { ...o
                    },
                    hitRateFilter: { ...d
                    },
                    tennisRankFilter: { ...c
                    },
                    sportFilters: Object.fromEntries(["all", "mlb", "nfl", "nba", "nhl", "cfb", "cbb", "wnba", "soccer", "tennis", "cod", "cs2", "val", "dota2", "lol"].map(e => [e, v()]))
                },
                b = e => {
                    let {
                        children: t
                    } = e, [r, l] = (0, s.useState)(g);
                    (0, s.useEffect)(() => {
                        let e = function() {
                            let e = x(f, {}),
                                t = null == e ? void 0 : e.pushProps,
                                r = "hide" === t || "only" === t ? t : "all";
                            return void 0 === t && (null == e ? void 0 : e.hidePushProps) === !0 && (r = "hide"), {
                                showAltLines: (null == e ? void 0 : e.showAltLines) === !0,
                                pushProps: r
                            }
                        }();
                        l(t => ({ ...t,
                            oddsFilter: function() {
                                let e = x(u, {}),
                                    t = "app" === e.oddsSource || "best" === e.oddsSource ? e.oddsSource : "best",
                                    r = "over" === e.oddsSide || "under" === e.oddsSide || "either" === e.oddsSide ? e.oddsSide : "either";
                                return { ...o,
                                    minOdds: "string" == typeof e.minOdds ? e.minOdds : "",
                                    maxOdds: "string" == typeof e.maxOdds ? e.maxOdds : "",
                                    oddsSource: t,
                                    oddsApp: "string" == typeof e.oddsApp ? e.oddsApp : "",
                                    oddsSide: r
                                }
                            }(),
                            hitRateFilter: function() {
                                let e = x(p, {}),
                                    t = Array.isArray(e.columns) ? e.columns.filter(e => "string" == typeof e) : [],
                                    r = "string" == typeof e.min ? e.min : "",
                                    i = "string" == typeof e.max ? e.max : "",
                                    s = "0" === r.trim() && "0" === i.trim();
                                return { ...d,
                                    min: s ? t.length > 0 ? "0" : "" : r,
                                    max: s ? t.length > 0 ? "100" : "" : i,
                                    columns: t
                                }
                            }(),
                            showAltLines: e.showAltLines,
                            pushProps: e.pushProps
                        }))
                    }, []);
                    let a = (e, t) => t && e[t] ? { ...e,
                            [t]: { ...e[t],
                                page: 1
                            }
                        } : e,
                        c = (0, s.useCallback)((e, t, r) => {
                            l(i => {
                                if (i[e] === t && !r) return i;
                                let s = i.sportFilters;
                                if (r) {
                                    let e = { ...i.sportFilters[r],
                                        page: 1
                                    };
                                    s = { ...i.sportFilters,
                                        [r]: e
                                    }
                                }
                                return i[e] === t && s === i.sportFilters ? i : ("oddsFilter" === e && h(u, t), "hitRateFilter" === e && h(p, t), ("showAltLines" === e || "pushProps" === e) && h(f, {
                                    showAltLines: "showAltLines" === e ? t : i.showAltLines,
                                    pushProps: "pushProps" === e ? t : i.pushProps
                                }), { ...i,
                                    [e]: t,
                                    sportFilters: s
                                })
                            })
                        }, []),
                        b = (0, s.useCallback)((e, t) => {
                            l(r => ({ ...r,
                                sportFilters: { ...r.sportFilters,
                                    [e]: { ...r.sportFilters[e] || v(),
                                        ...t
                                    }
                                }
                            }))
                        }, []),
                        j = (0, s.useCallback)((e, t, r) => {
                            if ("page" === t || "playerPage" === t) {
                                b(e, {
                                    [t]: r
                                });
                                return
                            }
                            b(e, {
                                [t]: r,
                                ..."playerSearch" !== t && "playerTeam" !== t ? {
                                    page: 1
                                } : {}
                            }), ("playerSearch" === t || "playerTeam" === t) && b(e, {
                                playerPage: 1
                            })
                        }, [b]),
                        w = (0, s.useCallback)((e, t) => {
                            l(r => {
                                let i = { ...r.oddsFilter,
                                    ...e
                                };
                                return h(u, i), { ...r,
                                    oddsFilter: i,
                                    sportFilters: a(r.sportFilters, t)
                                }
                            })
                        }, []),
                        y = (0, s.useCallback)((e, t) => {
                            l(r => {
                                let i = { ...r.hitRateFilter,
                                    ...e
                                };
                                return h(p, i), { ...r,
                                    hitRateFilter: i,
                                    sportFilters: a(r.sportFilters, t)
                                }
                            })
                        }, []),
                        N = (0, s.useCallback)((e, t) => {
                            l(r => ({ ...r,
                                tennisRankFilter: { ...r.tennisRankFilter,
                                    ...e
                                },
                                sportFilters: a(r.sportFilters, t)
                            }))
                        }, []),
                        k = (0, s.useCallback)((e, t) => {
                            h(u, t.oddsFilter), h(p, t.hitRateFilter), l(r => (h(f, {
                                showAltLines: t.showAltLines,
                                pushProps: r.pushProps
                            }), { ...r,
                                sort: t.sort,
                                winChanceRange: t.winChanceRange,
                                showAltLines: t.showAltLines,
                                oddsFilter: { ...t.oddsFilter
                                },
                                hitRateFilter: { ...t.hitRateFilter,
                                    columns: [...t.hitRateFilter.columns]
                                },
                                tennisRankFilter: { ...t.tennisRankFilter
                                },
                                sportFilters: { ...r.sportFilters,
                                    [e]: { ...r.sportFilters[e] || v(),
                                        stats: [...t.stats],
                                        page: 1
                                    }
                                }
                            }))
                        }, []);
                    return (0, i.jsx)(n.Provider, {
                        value: {
                            userFilters: r,
                            setUserFilter: c,
                            setSportFilter: j,
                            setOddsFilter: w,
                            setHitRateFilter: y,
                            setTennisRankFilter: N,
                            applyPropPresetFilters: k,
                            resetFilters: () => {
                                h(u, o), h(p, d), h(f, m), l(g)
                            },
                            initialFilters: g
                        },
                        children: t
                    })
                },
                j = () => (0, s.useContext)(n)
        },
        68886: function(e, t, r) {
            "use strict";
            r.d(t, {
                An: function() {
                    return f
                },
                D3: function() {
                    return p
                },
                sx: function() {
                    return m
                }
            });
            var i = r(10131),
                s = r(55185),
                l = r(69237),
                n = r(67057),
                a = r(28876),
                o = r(14375),
                d = r(44209),
                c = r(8933);
            let u = (0, s.createContext)(null);

            function p(e) {
                let {
                    children: t
                } = e, [r, l] = (0, s.useState)(!1), [n, a] = (0, s.useState)(void 0), [p, f] = (0, s.useState)(!1), [x, h] = (0, s.useState)(void 0), [v, g] = (0, s.useState)(void 0), [b, j] = (0, s.useState)(!1), [w, y] = (0, s.useState)(!1), [N, k] = (0, s.useState)(void 0), [C, P] = (0, s.useState)(void 0), {
                    state: _
                } = m(), A = _.hasPaid, F = (0, s.useCallback)(e => {
                    k(null == e ? void 0 : e.interval), P(null == e ? void 0 : e.source), y(!0)
                }, []), L = (0, s.useCallback)(e => {
                    if (!A) {
                        F({
                            source: e
                        });
                        return
                    }
                    a(e), l(!0)
                }, [A, F]), S = (0, s.useCallback)(e => {
                    if (!A) {
                        F(e);
                        return
                    }
                    h(null == e ? void 0 : e.interval), g(null == e ? void 0 : e.source), f(!0)
                }, [A, F]), Z = (0, s.useCallback)(() => j(!0), []), R = (0, s.useCallback)(e => {
                    A ? _.isTrialEligible ? L(e) : S({
                        source: e
                    }) : F({
                        source: e
                    })
                }, [A, F, L, S, _.isTrialEligible]), O = (0, s.useMemo)(() => ({
                    openProTrial: L,
                    openProUpgrade: S,
                    openProTrialStatus: Z,
                    openProGate: R
                }), [R, L, Z, S]);
                return (0, i.jsxs)(u.Provider, {
                    value: O,
                    children: [t, (0, i.jsx)(d.N3, {
                        open: r,
                        onOpenChange: l,
                        source: n
                    }), (0, i.jsx)(o.FY, {
                        open: p,
                        onOpenChange: f,
                        defaultInterval: x,
                        source: v
                    }), (0, i.jsx)(d.IY, {
                        open: b,
                        onOpenChange: j,
                        onUpgrade: () => {
                            j(!1), S({
                                source: "trial_status"
                            })
                        }
                    }), (0, i.jsx)(c.Ei, {
                        open: w,
                        onOpenChange: y,
                        defaultTier: "pro",
                        defaultInterval: N,
                        signedOutBehavior: "paywall-first",
                        source: null != C ? C : "pro_gate"
                    })]
                })
            }

            function f() {
                let e = (0, s.useContext)(u),
                    t = (0, n.useRouter)();
                return (0, s.useMemo)(() => {
                    if (e) return e;
                    let r = e => {
                        let r = (null == e ? void 0 : e.interval) ? "?interval=".concat(e.interval) : "";
                        t.push("".concat(a.MP).concat(r))
                    };
                    return {
                        openProTrial: () => r(),
                        openProUpgrade: r,
                        openProTrialStatus: () => r(),
                        openProGate: () => r()
                    }
                }, [e, t])
            }

            function m() {
                var e;
                let {
                    user: t,
                    isLoaded: r,
                    isSignedIn: i
                } = (0, l.aF)(), [n, o] = (0, s.useState)(!1), [d, c] = (0, s.useState)(() => Date.now());
                (0, s.useEffect)(() => {
                    o(!0);
                    let e = setInterval(() => c(Date.now()), 6e4);
                    return () => clearInterval(e)
                }, []);
                let u = null !== (e = null == t ? void 0 : t.publicMetadata) && void 0 !== e ? e : null,
                    p = (0, s.useMemo)(() => (0, a.qH)(u, d), [u, d]);
                return {
                    user: t,
                    isLoaded: r,
                    isSignedIn: !!i,
                    mounted: n,
                    metadata: u,
                    state: p
                }
            }
        },
        77606: function(e, t, r) {
            "use strict";
            r.d(t, {
                I: function() {
                    return n
                },
                v: function() {
                    return a
                }
            });
            var i = r(10131),
                s = r(55185);
            let l = (0, s.createContext)({});

            function n(e) {
                let {
                    children: t
                } = e, [r, n] = (0, s.useState)(0), [a, o] = (0, s.useState)(0), [d, c] = (0, s.useState)(0), u = (0, s.useMemo)(() => ({
                    scrollPosition: r,
                    discrepanciesScrollPosition: a,
                    trendingScrollPosition: d,
                    setScrollPosition: n,
                    setDiscrepanciesScrollPosition: o,
                    setTrendingScrollPosition: c
                }), [r, a, d]);
                return (0, i.jsx)(l.Provider, {
                    value: u,
                    children: t
                })
            }
            let a = () => (0, s.useContext)(l)
        },
        4695: function(e, t, r) {
            "use strict";
            r.d(t, {
                J: function() {
                    return l
                }
            });
            var i = r(87743),
                s = r(93630);

            function l() {
                return (0, i._)("appsOrder", s.w$, {
                    deserializer: e => {
                        if ("undefined" === e || null === e || "" === e) return s.w$;
                        try {
                            let t = JSON.parse(e),
                                r = Array.isArray(t) ? t : null;
                            return function(e, t) {
                                if (!e || !Array.isArray(e) || 0 === e.length) return t;
                                let r = new Set(t),
                                    i = e.filter(e => "string" == typeof e && r.has(e)),
                                    s = t.filter(e => !i.includes(e));
                                return [...i, ...s]
                            }(r, s.w$)
                        } catch (e) {
                            return s.w$
                        }
                    }
                })
            }
        },
        81057: function(e, t, r) {
            "use strict";
            var i = r(55185);
            t.Z = function() {
                let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 768,
                    [t, r] = (0, i.useState)(!1),
                    s = (0, i.useCallback)(() => {
                        r(window.innerWidth < e)
                    }, [e]);
                return (0, i.useEffect)(() => (s(), window.addEventListener("resize", s), () => window.removeEventListener("resize", s)), [s]), t
            }
        },
        88773: function(e, t, r) {
            "use strict";
            r.d(t, {
                i: function() {
                    return s
                }
            });
            var i = r(72044);

            function s(e) {
                let t = i.env.NEXT_PUBLIC_INTERNAL_API_TOKEN;
                return {
                    "Content-Type": "application/json",
                    ...e && {
                        Authorization: "Bearer ".concat(e)
                    },
                    ...t && {
                        "x-internal-token": t
                    }
                }
            }
        },
        52924: function(e, t, r) {
            "use strict";

            function i() {
                var e, t, r, i;
                let s = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
                    l = null !== (i = null === (r = window.webkit) || void 0 === r ? void 0 : null === (t = r.messageHandlers) || void 0 === t ? void 0 : t.requestReview) && void 0 !== i ? i : null;
                if (!l) return !1;
                let n = null !== (e = s.storageKey) && void 0 !== e ? e : "pickfinder:native-review:last-requested-at",
                    a = s.cooldownMs;
                if (void 0 !== a && ! function(e, t) {
                        try {
                            let r = Number(window.localStorage.getItem(e));
                            if (!Number.isFinite(r) || r <= 0) return !0;
                            return Date.now() - r >= t
                        } catch (e) {
                            return !0
                        }
                    }(n, a)) return !1;
                try {
                    return l.postMessage({
                        event: "requestReview"
                    }), ! function(e) {
                        try {
                            window.localStorage.setItem(e, String(Date.now()))
                        } catch (e) {}
                    }(n), !0
                } catch (e) {
                    return !1
                }
            }

            function s() {
                let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                return i({ ...e,
                    cooldownMs: 2592e6
                })
            }
            r.d(t, {
                N: function() {
                    return i
                },
                v: function() {
                    return s
                }
            })
        },
        38977: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return a
                }
            });
            var i = r(47898),
                s = r(69948),
                l = r(55185),
                n = r(88773);

            function a(e, t) {
                let {
                    getToken: r,
                    isLoaded: a,
                    userId: o
                } = (0, s.y)(), d = !!e && !a, c = (0, l.useCallback)(async e => {
                    let t = await r();
                    if (!t) throw Error("Authentication token is not available.");
                    let i = await fetch(e, {
                        method: "GET",
                        mode: "cors",
                        headers: (0, n.i)(t)
                    });
                    if (!i.ok) throw Error("An error occurred while fetching the data.");
                    return i.json()
                }, [r]), u = (0, i.Z)(a && o ? e : null, c, t);
                return { ...u,
                    isLoading: d || u.isLoading,
                    isValidating: d || u.isValidating
                }
            }
        }
    },
    function(e) {
        e.O(0, [9732, 5308, 6717, 1069, 6582, 792, 748, 4885, 8819, 9479, 4640, 2468, 9596, 6699, 679, 3209, 1872, 1478, 1469, 6381, 6847, 4860, 1592, 8933, 4358, 4375, 5552, 1355, 1744], function() {
            return e(e.s = 56147)
        }), _N_E = e.O()
    }
]);