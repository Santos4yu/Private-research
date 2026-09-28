"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4676], {
        24873: function(e, t, r) {
            r.d(t, {
                EZ: function() {
                    return k
                },
                lW: function() {
                    return j
                }
            });
            var a = r(10131),
                s = r(63210),
                i = r(4695),
                n = r(47288),
                o = r(75775),
                l = r(77463),
                d = r(36098),
                c = r(55904),
                u = r(69687),
                p = r(50555),
                f = r(51465),
                m = r(43774),
                h = r(37220),
                x = r(55185),
                g = r(54308);
            let b = e => "".concat((100 * e).toFixed(1), "%"),
                v = "The chance of the player going over/under the line, purely based on the odds (only available for lines that are on multiple books). For the most profitable odds, take over/unders higher than 54.3% and run 5/6 leg flex parlays.",
                y = (0, x.memo)(function(e) {
                    let {
                        isMobile: t,
                        consensus: r
                    } = e, i = r.over.implied_probability, n = r.under.implied_probability;
                    return i || n ? (0, a.jsx)("div", {
                        className: "relative",
                        children: t ? (0, a.jsxs)(f.J2, {
                            children: [(0, a.jsx)(f.xo, {
                                asChild: !0,
                                children: (0, a.jsx)(u.z, {
                                    className: (0, s.Z)("border-blue-500 flex items-center gap-1 bg-gradient-to-b h-12 w-full from-gray-800 to-gray-900 hover:brightness-125 hover:bg-inherit", "text-muted-foreground"),
                                    children: (0, a.jsxs)("div", {
                                        className: "flex items-center gap-1 w-max",
                                        children: [(0, a.jsx)(o.default, {
                                            alt: "pflogo",
                                            src: "/logo.png",
                                            width: 24,
                                            height: 24
                                        }), (0, a.jsx)(N, {
                                            consensus: r
                                        }), (0, a.jsx)(l.Z, {
                                            className: "h-4 w-4 text-muted-foreground ml-1"
                                        })]
                                    })
                                })
                            }), (0, a.jsx)(f.yk, {
                                className: "w-80 text-sm z-50 bg-card-bg border border-input-border/50 shadow-lg",
                                side: "top",
                                align: "start",
                                children: v
                            })]
                        }) : (0, a.jsx)(p.pn, {
                            delayDuration: 100,
                            children: (0, a.jsxs)(p.u, {
                                children: [(0, a.jsx)(p.aJ, {
                                    asChild: !0,
                                    children: (0, a.jsx)(u.z, {
                                        variant: "outline",
                                        className: (0, s.Z)("border-blue-500 flex items-center gap-1 bg-gradient-to-b h-12 w-full from-gray-800 to-gray-900 hover:brightness-125 hover:bg-inherit", "text-muted-foreground"),
                                        children: (0, a.jsxs)("div", {
                                            className: "flex items-center gap-1 w-max",
                                            children: [(0, a.jsx)(o.default, {
                                                alt: "pflogo",
                                                src: "/logo.png",
                                                width: 24,
                                                height: 24
                                            }), (0, a.jsx)(N, {
                                                consensus: r
                                            }), (0, a.jsx)(l.Z, {
                                                className: "h-4 w-4 text-muted-foreground ml-1"
                                            })]
                                        })
                                    })
                                }), (0, a.jsx)(p._v, {
                                    className: "w-80 text-sm z-50 bg-card-bg border border-input-border/50",
                                    side: "top",
                                    align: "start",
                                    children: v
                                })]
                            })
                        })
                    }) : null
                }),
                w = (0, x.memo)(function(e) {
                    let {
                        app: t,
                        outcomes: r,
                        appMap: i
                    } = e;
                    return (0, a.jsx)("div", {
                        className: "relative w-full",
                        children: g.p[t] && g.p[t].isLive ? (0, a.jsxs)(f.J2, {
                            children: [(0, a.jsx)(f.xo, {
                                asChild: !0,
                                children: (0, a.jsxs)("div", {
                                    className: "relative w-full",
                                    children: [(0, a.jsx)("div", {
                                        className: "absolute -top-3 left-1/2 transform -translate-x-1/2",
                                        style: {
                                            zIndex: 9999
                                        },
                                        children: (0, a.jsx)("span", {
                                            className: "bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full",
                                            children: g.p[t].amount
                                        })
                                    }), (0, a.jsx)(u.z, {
                                        variant: "outline",
                                        className: "cursor-pointer flex items-center gap-1 bg-gradient-to-b h-12 w-full from-gray-800 to-gray-900 hover:brightness-125 hover:bg-inherit text-muted-foreground border-emerald-500/50",
                                        children: (0, a.jsx)(n.Z, {
                                            appName: t,
                                            outcomes: r,
                                            size: 24
                                        })
                                    })]
                                })
                            }), (0, a.jsx)(f.yk, {
                                className: "w-80 p-0 z-50 bg-new-bg border border-new-bg rounded-lg overflow-hidden shadow-lg",
                                side: "top",
                                children: (0, a.jsx)(m.C, {
                                    app: t,
                                    appName: i[t] || t
                                })
                            })]
                        }) : (0, a.jsx)(u.z, {
                            variant: "outline",
                            className: (0, s.Z)("cursor-default flex items-center gap-1 bg-gradient-to-b h-12 w-full from-gray-800 to-gray-900 hover:brightness-125 hover:bg-inherit", "text-muted-foreground"),
                            children: (0, a.jsx)(n.Z, {
                                appName: t,
                                outcomes: r,
                                size: 24
                            })
                        })
                    }, t)
                });
            t.ZP = (0, x.memo)(function(e) {
                let {
                    selectedAltLine: t
                } = e, {
                    initialFilters: r
                } = (0, d.mN)(), [s, n] = (0, i.J)(), o = (0, h.a)("(max-width: 768px)");
                return !t || Object.keys(t.apps).length < 1 ? (0, a.jsx)("div", {
                    className: "pb-1.5 pt-2.5",
                    children: (0, a.jsx)("div", {
                        className: "grid rounded-lg place-items-center text-sm text-muted-foreground gap-1 bg-gradient-to-b h-12 w-full from-gray-800 to-gray-900 hover:brightness-125 hover:bg-inherit",
                        children: "No alt line selected"
                    })
                }) : (0, a.jsx)("div", {
                    className: "flex overflow-visible",
                    children: (0, a.jsxs)(c.x, {
                        className: "w-1 flex-1 pb-1.5 overflow-visible",
                        children: [(0, a.jsxs)("div", {
                            className: "flex items-center gap-1 pt-2.5",
                            children: [t && t.consensus && (0, a.jsx)(y, {
                                isMobile: o,
                                consensus: t.consensus
                            }), s.map(e => {
                                var s;
                                return t.apps[e] ? (0, a.jsx)(w, {
                                    app: e,
                                    outcomes: null !== (s = t.apps[e].outcomes) && void 0 !== s ? s : {},
                                    appMap: r.appMap
                                }, e) : null
                            })]
                        }), (0, a.jsx)(c.B, {
                            orientation: "horizontal",
                            className: "w-full"
                        })]
                    })
                })
            });
            let N = (0, x.memo)(function(e) {
                    let {
                        consensus: t
                    } = e, r = t.over.implied_probability, i = t.under.implied_probability;
                    return r || i ? (0, a.jsxs)("div", {
                        className: "ml-1 flex flex-col items-start h-min text-mxs",
                        children: [r && (0, a.jsxs)("span", {
                            className: "text-slate-400",
                            children: ["O", (0, a.jsx)("span", {
                                className: (0, s.Z)("ml-1 font-extrabold", r > .543 ? "text-emerald-400 drop-shadow-glow" : r > i ? "text-yellow-500 drop-shadow-glow" : "text-red-500 drop-shadow-glow"),
                                children: b(r)
                            })]
                        }), i && (0, a.jsxs)("span", {
                            className: "text-slate-400",
                            children: ["U", (0, a.jsx)("span", {
                                className: (0, s.Z)("ml-1 font-extrabold", i > .543 ? "text-emerald-400 drop-shadow-glow" : i > r ? "text-yellow-500 drop-shadow-glow" : "text-red-500 drop-shadow-glow"),
                                children: b(i)
                            })]
                        })]
                    }) : null
                }),
                j = (0, x.memo)(function(e) {
                    let {
                        consensus: t
                    } = e, r = t.over.implied_probability, s = t.under.implied_probability;
                    if (!r && !s) return null;
                    let i = r + s,
                        n = r / i * 100,
                        o = s / i * 100,
                        l = r > .543 ? "text-emerald-400 stroke-emerald-400" : r > s ? "text-yellow-500 stroke-yellow-500" : "text-red-500 stroke-red-500",
                        d = s > .543 ? "text-emerald-400 stroke-emerald-400" : s > r ? "text-yellow-500 stroke-yellow-500" : "text-red-500 stroke-red-500";
                    return (0, a.jsxs)("div", {
                        className: "relative w-16 h-16",
                        children: [(0, a.jsxs)("svg", {
                            className: "absolute top-0 left-0",
                            viewBox: "0 0 36 36",
                            children: [(0, a.jsx)("path", {
                                d: "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831",
                                fill: "none",
                                stroke: "#2d3748",
                                strokeWidth: "3"
                            }), (0, a.jsx)("path", {
                                d: "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831",
                                fill: "none",
                                className: d,
                                strokeWidth: "3",
                                strokeDasharray: "".concat(o, ", 100")
                            }), (0, a.jsx)("path", {
                                d: "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831",
                                fill: "none",
                                className: l,
                                strokeWidth: "3",
                                strokeDasharray: "".concat(n, ", 100"),
                                strokeDashoffset: -o
                            })]
                        }), (0, a.jsx)("div", {
                            className: "absolute inset-0 flex flex-col items-center justify-center",
                            children: (0, a.jsxs)("div", {
                                className: "text-center",
                                children: [(0, a.jsxs)("span", {
                                    className: "block text-xxs ".concat(l.replace("stroke-", "")),
                                    children: ["O ", b(r)]
                                }), (0, a.jsxs)("span", {
                                    className: "block text-xxs ".concat(d.replace("stroke-", "")),
                                    children: ["U ", b(s)]
                                })]
                            })
                        })]
                    })
                }),
                k = (0, x.memo)(function(e) {
                    let {
                        prop: t
                    } = e, r = t.consensus_over_ip, i = t.consensus_under_ip;
                    if (!r && !i) return null;
                    let n = b(r),
                        o = b(i);
                    return (0, a.jsx)("div", {
                        className: "grid place-items-center",
                        children: r || i ? (0, a.jsx)("div", {
                            className: "py-1 w-[4.5rem] grid place-items-center rounded-lg border border-input bg-gradient-to-b from-slate-800 to-slate-900/50",
                            children: (0, a.jsxs)("div", {
                                className: "flex  flex-col items-start h-min text-xs",
                                children: [r && (0, a.jsxs)("span", {
                                    className: "font-bold text-slate-300",
                                    children: ["O", (0, a.jsx)("span", {
                                        className: (0, s.Z)("ml-2 font-semibold", r > .543 ? "text-emerald-400 drop-shadow-glow" : n > o ? "text-yellow-500 drop-shadow-glow" : "text-red-500 drop-shadow-glow"),
                                        children: n
                                    })]
                                }), i && (0, a.jsxs)("span", {
                                    className: "font-semibold text-slate-300",
                                    children: ["U", (0, a.jsx)("span", {
                                        className: (0, s.Z)("ml-2 font-semibold", i > .543 ? "text-emerald-400 drop-shadow-glow" : i > r ? "text-yellow-500 drop-shadow-glow" : "text-red-500 drop-shadow-glow"),
                                        children: o
                                    })]
                                })]
                            })
                        }) : (0, a.jsx)("p", {
                            className: "grid place-items-center text-muted-foreground",
                            children: "-"
                        })
                    })
                })
        },
        74093: function(e, t, r) {
            r.d(t, {
                MaintenanceRefreshButton: function() {
                    return o
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(73249),
                n = r(69687);

            function o() {
                let [e, t] = (0, s.useState)(!1);
                return (0, a.jsxs)(n.z, {
                    type: "button",
                    variant: "blue",
                    size: "sm",
                    className: "w-auto gap-1.5 px-3",
                    disabled: e,
                    onClick: () => {
                        t(!0), window.location.reload()
                    },
                    children: [(0, a.jsx)(i.Z, {
                        className: "h-3.5 w-3.5 ".concat(e ? "animate-spin" : "")
                    }), "Refresh"]
                })
            }
        },
        39248: function(e, t, r) {
            r.d(t, {
                o: function() {
                    return s
                }
            });
            var a = r(10131);

            function s(e) {
                let {
                    icon: t,
                    title: r,
                    description: s,
                    ghost: n,
                    focalOffset: o,
                    fill: l,
                    action: d
                } = e;
                return (0, a.jsxs)("div", {
                    className: "relative w-full ".concat(l ? "h-full min-h-0 flex-1" : ""),
                    children: [n, (0, a.jsx)("div", {
                        className: "absolute inset-0 flex items-center justify-center",
                        children: (0, a.jsxs)("div", {
                            className: "relative flex flex-col items-center gap-3 ".concat(null != o ? o : ""),
                            children: [(0, a.jsx)("div", {
                                className: "pointer-events-none absolute -inset-8 -z-0",
                                style: {
                                    background: "radial-gradient(closest-side, hsla(228,55%,10%,0.9), transparent 100%)"
                                },
                                "aria-hidden": "true"
                            }), (0, a.jsxs)("div", {
                                className: "relative z-10 flex items-center justify-center",
                                children: [(0, a.jsxs)("div", {
                                    className: "absolute flex items-center justify-center",
                                    style: {
                                        maskImage: i,
                                        WebkitMaskImage: i
                                    },
                                    "aria-hidden": "true",
                                    children: [(0, a.jsx)("div", {
                                        className: "absolute h-[4.75rem] w-[4.75rem] rounded-full border border-white/[0.08]"
                                    }), (0, a.jsx)("div", {
                                        className: "absolute h-[6.75rem] w-[6.75rem] rounded-full border border-white/[0.04]"
                                    })]
                                }), (0, a.jsx)("div", {
                                    className: "absolute h-24 w-24 rounded-full blur-2xl",
                                    style: {
                                        background: "radial-gradient(circle, hsla(224,80%,62%,0.28), transparent 70%)"
                                    },
                                    "aria-hidden": "true"
                                }), (0, a.jsx)("div", {
                                    className: "relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.14] to-white/[0.03]",
                                    style: {
                                        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.16), 0 10px 30px -8px rgba(0,0,0,0.6)"
                                    },
                                    children: (0, a.jsx)(t, {
                                        className: "h-[1.3rem] w-[1.3rem] text-primary/85",
                                        strokeWidth: 1.75
                                    })
                                })]
                            }), (0, a.jsx)("span", {
                                className: "relative z-10 text-sm font-semibold tracking-tight text-muted-foreground",
                                children: r
                            }), s && (0, a.jsx)("p", {
                                className: "relative z-10 -mt-1 max-w-[15rem] text-center text-xs leading-relaxed text-muted-foreground/60 [text-wrap:balance]",
                                children: s
                            }), d && (0, a.jsx)("div", {
                                className: "relative z-10 flex flex-col items-center gap-3",
                                children: d
                            })]
                        })
                    })]
                })
            }
            let i = "radial-gradient(circle, black 35%, transparent 78%)"
        },
        64276: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(63210);

            function n(e) {
                let {
                    imageUrl: t,
                    src: r,
                    sport: n,
                    teamName: o,
                    name: l,
                    alt: d,
                    abbreviation: c,
                    teamKey: u,
                    size: p = 22,
                    className: f,
                    imageClassName: m,
                    fallbackSrc: h = "https://assets.pickfinder.app/teams/fallback.png",
                    priority: x = !1
                } = e, [g, b] = (0, s.useState)(!1), v = (0, s.useCallback)(() => b(!0), []), y = function() {
                    for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                    for (let e of t) {
                        let t = null == e ? void 0 : e.trim().replace(/^@\s?/, "");
                        if (t && t.length <= 8 && /^[a-z0-9]+$/i.test(t) && /[a-z]/i.test(t)) return t.toLowerCase()
                    }
                }(c, u), w = t || r, N = n && y ? "https://assets.pickfinder.app/teams/".concat(n, "/").concat(y, ".png") : void 0;
                (0, s.useEffect)(() => {
                    b(!1)
                }, [w, N]);
                let j = (0, s.useMemo)(() => g || function(e) {
                        if (!e) return !1;
                        let t = e.trim().toLowerCase();
                        if (t.includes("/team-logos/unknown.jpg") || t.endsWith("/unknown.jpg")) return !0;
                        try {
                            let e = new URL(t);
                            return "cdn.opticodds.com" === e.hostname && "/team-logos/unknown.jpg" === e.pathname
                        } catch (e) {
                            return !1
                        }
                    }(w) ? h : w || N || h, [N, g, h, w]),
                    k = (0, s.useCallback)(e => {
                        let t = e.currentTarget;
                        600 === t.naturalWidth && 436 === t.naturalHeight && t.currentSrc.includes("assets.pickfinder.app/teams/") && b(!0)
                    }, []);
                return ("all" !== n || w) && j ? (0, a.jsx)("img", {
                    src: j,
                    alt: d || o || l || c || u || "Team",
                    width: p,
                    height: p,
                    className: (0, i.Z)("object-contain flex-shrink-0", f, m),
                    style: {
                        width: p,
                        height: p,
                        minWidth: p,
                        minHeight: p
                    },
                    onError: v,
                    onLoad: k,
                    loading: x ? "eager" : "lazy",
                    decoding: "async"
                }) : null
            }
        },
        29562: function(e, t, r) {
            r.d(t, {
                E: function() {
                    return l
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(47288),
                n = r(51465),
                o = r(63210);
            let l = (0, s.memo)(function(e) {
                let {
                    prop: t,
                    appsOrder: r,
                    maxModifiers: l,
                    forceRow: d,
                    hideModifiers: c,
                    count: u,
                    apps: p,
                    size: f,
                    inSelect: m,
                    outcomesClassName: h
                } = e, x = p || (null == t ? void 0 : t.apps), [g, b] = (0, s.useState)(!1);
                if ((0, s.useEffect)(() => b(!0), []), !x) return null;
                let [v, y] = (0, s.useState)(!1), w = u || 3, N = r.filter(e => x[e]);
                N.slice(0, w);
                let j = N.slice(w);
                return (0, a.jsxs)("div", {
                    className: "flex items-center",
                    children: [(0, a.jsx)("div", {
                        className: (0, o.Z)("flex items-center", !c && " divide-x divide-gray-700"),
                        children: g && N.slice(0, w).map((e, t) => {
                            let r = x[e];
                            return (0, a.jsx)("div", {
                                className: (0, o.Z)("first:pl-0 last:pr-0", c ? "px-0.5" : "px-2"),
                                children: (0, a.jsx)(i.Z, {
                                    appName: e,
                                    outcomes: c || l && t >= l ? void 0 : r.outcomes,
                                    outcomesClassName: h,
                                    size: f || (c ? 20 : 24),
                                    forceRow: d
                                })
                            }, e)
                        })
                    }), g && j.length > 0 && (m ? (0, a.jsxs)("div", {
                        "data-row-click-ignore": "true",
                        className: "cursor-pointer ml-2 h-6 border border-input px-2 bg-gradient-to-b from-highlight to-highlight/40 rounded-full flex items-center justify-center",
                        children: [(0, a.jsxs)("span", {
                            className: "text-xs font-medium text-gray-600 dark:text-gray-400",
                            children: ["+", j.length]
                        }), (0, a.jsxs)("span", {
                            className: "sr-only",
                            children: ["Show ", j.length, " more apps"]
                        })]
                    }) : (0, a.jsxs)(n.J2, {
                        open: v,
                        onOpenChange: y,
                        children: [(0, a.jsx)(n.xo, {
                            asChild: !0,
                            children: (0, a.jsxs)("div", {
                                "data-row-click-ignore": "true",
                                className: "cursor-pointer ml-2 h-6 border border-input px-2 bg-gradient-to-b from-highlight to-highlight/40 rounded-full flex items-center justify-center",
                                children: [(0, a.jsxs)("span", {
                                    className: "text-xs font-medium text-gray-600 dark:text-gray-400",
                                    children: ["+", j.length]
                                }), (0, a.jsxs)("span", {
                                    className: "sr-only",
                                    children: ["Show ", j.length, " more apps"]
                                })]
                            })
                        }), (0, a.jsx)(n.yk, {
                            className: "w-auto bg-card-bg p-4",
                            align: "start",
                            children: (0, a.jsx)("div", {
                                className: "flex flex-wrap gap-4 max-w-80",
                                children: j.map(e => {
                                    let t = x[e];
                                    return (0, a.jsx)("div", {
                                        className: "first:pl-0 last:pr-0",
                                        children: (0, a.jsx)(i.Z, {
                                            appName: e,
                                            outcomes: c ? void 0 : t.outcomes,
                                            outcomesClassName: h,
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
        43774: function(e, t, r) {
            r.d(t, {
                C: function() {
                    return f
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(59564),
                n = r(63833),
                o = r(77463),
                l = r(86128),
                d = r(47288),
                c = r(69687),
                u = r(63855),
                p = r(54308);
            let f = (0, s.memo)(function(e) {
                var t;
                let {
                    app: r,
                    appName: f
                } = e, [m, h] = (0, s.useState)(null), x = p.p[r];
                if (!x || !x.isLive) return null;
                let g = e => {
                    navigator.clipboard.writeText(e), h(e), setTimeout(() => h(null), 2e3)
                };
                return (0, a.jsxs)("div", {
                    className: "flex flex-col",
                    children: [(0, a.jsx)("div", {
                        className: "h-12 bg-card-header border-b-2 border-input-border/50 text-sm flex shadow-lg items-center px-6",
                        children: (0, a.jsxs)("div", {
                            className: "flex items-center gap-2",
                            children: [(0, a.jsx)("div", {
                                className: "h-8 w-8",
                                children: (0, a.jsx)(d.Z, {
                                    appName: r,
                                    size: 32
                                })
                            }), (0, a.jsx)("h3", {
                                className: "font-bold",
                                children: null !== (t = null != f ? f : x.appName) && void 0 !== t ? t : r
                            })]
                        })
                    }), (0, a.jsxs)("div", {
                        className: "p-4 gap-4 flex flex-col",
                        children: [(0, a.jsxs)("div", {
                            className: "bg-highlight px-4 py-3 rounded-md border border-input-border/50",
                            children: [(0, a.jsx)("p", {
                                className: "font-medium",
                                children: x.offerText
                            }), x.promoCode && (0, a.jsxs)("div", {
                                className: "mt-2 flex items-center gap-2",
                                children: [(0, a.jsx)("span", {
                                    className: "text-sm text-muted-foreground",
                                    children: "Code:"
                                }), (0, a.jsxs)("div", {
                                    className: "flex items-center gap-2",
                                    children: [(0, a.jsx)("span", {
                                        className: "bg-input-bg px-2 py-1 rounded border border-input-border/50 text-emerald-300 font-mono",
                                        children: x.promoCode
                                    }), (0, a.jsx)(c.z, {
                                        variant: "outline",
                                        size: "sm",
                                        className: "h-7 px-2 border-input-border/50 bg-card-header hover:bg-card-header/80",
                                        onClick: () => g(x.promoCode),
                                        children: m === x.promoCode ? (0, a.jsx)(i.Z, {
                                            className: "h-4 w-4 text-emerald-500"
                                        }) : (0, a.jsx)(n.Z, {
                                            className: "h-4 w-4"
                                        })
                                    })]
                                })]
                            })]
                        }), x.disclaimer && (0, a.jsxs)(u.Vq, {
                            children: [(0, a.jsx)(u.hg, {
                                asChild: !0,
                                children: (0, a.jsxs)("button", {
                                    className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 w-full",
                                    children: ["See Full Terms ", (0, a.jsx)(o.Z, {
                                        className: "h-4 w-4"
                                    })]
                                })
                            }), (0, a.jsxs)(u.cZ, {
                                className: "max-w-2xl max-h-[80vh] overflow-y-auto",
                                children: [(0, a.jsx)(u.fK, {
                                    children: (0, a.jsxs)(u.$N, {
                                        children: ["Terms and Conditions - ", x.appName]
                                    })
                                }), (0, a.jsx)("div", {
                                    className: "mt-4",
                                    children: (0, a.jsx)("p", {
                                        className: "text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap",
                                        children: x.disclaimer
                                    })
                                })]
                            })]
                        }), (0, a.jsxs)("a", {
                            href: x.offerLink,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2",
                            children: ["Get Offer ", (0, a.jsx)(l.Z, {
                                className: "h-4 w-4"
                            })]
                        }), (0, a.jsxs)("div", {
                            className: "text-xs text-muted-foreground border-t border-input-border/50 pt-3",
                            children: [(0, a.jsx)("p", {
                                className: "mb-1 font-medium",
                                children: "RESPONSIBLE GAMBLING NOTICE:"
                            }), (0, a.jsx)("p", {
                                children: "Must be 21+. If you or someone you know has a gambling problem, call 1-800-GAMBLER for help."
                            })]
                        })]
                    })]
                })
            })
        },
        55904: function(e, t, r) {
            r.d(t, {
                B: function() {
                    return l
                },
                x: function() {
                    return o
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(92864),
                n = r(58685);
            let o = s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    ...o
                } = e;
                return (0, a.jsxs)(i.fC, {
                    ref: t,
                    className: (0, n.cn)("relative overflow-hidden", r),
                    ...o,
                    children: [(0, a.jsx)(i.l_, {
                        className: "h-full w-full rounded-[inherit]",
                        children: s
                    }), (0, a.jsx)(l, {}), (0, a.jsx)(i.Ns, {})]
                })
            });
            o.displayName = i.fC.displayName;
            let l = s.forwardRef((e, t) => {
                let {
                    className: r,
                    orientation: s = "vertical",
                    ...o
                } = e;
                return (0, a.jsx)(i.gb, {
                    ref: t,
                    orientation: s,
                    className: (0, n.cn)("flex touch-none select-none transition-colors z-20", "vertical" === s && "h-full w-2.5 border-l border-l-transparent p-[1px]", "horizontal" === s && "h-2.5 flex-col border-t border-t-transparent p-[1px]", r),
                    ...o,
                    children: (0, a.jsx)(i.q4, {
                        className: "relative flex-1 rounded-full bg-border"
                    })
                })
            });
            l.displayName = i.gb.displayName
        },
        66351: function(e, t, r) {
            r.d(t, {
                Bw: function() {
                    return m
                },
                DI: function() {
                    return d
                },
                Ph: function() {
                    return l
                },
                Ql: function() {
                    return x
                },
                i4: function() {
                    return u
                },
                ki: function() {
                    return c
                },
                n5: function() {
                    return h
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(2663),
                n = r(71163),
                o = r(58685);
            let l = n.fC,
                d = n.ZA,
                c = n.B4,
                u = s.forwardRef((e, t) => {
                    let {
                        className: r,
                        children: s,
                        ...l
                    } = e;
                    return (0, a.jsxs)(n.xz, {
                        ref: t,
                        className: (0, o.cn)("flex h-9 min-h-9 w-full items-center overflow-hidden justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-4 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-primary", r),
                        ...l,
                        children: [s, (0, a.jsx)(n.JO, {
                            asChild: !0,
                            children: (0, a.jsx)(i.v4q, {
                                className: "h-4 w-4 shrink-0 opacity-50 ml-1"
                            })
                        })]
                    })
                });
            u.displayName = n.xz.displayName;
            let p = s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, a.jsx)(n.u_, {
                    ref: t,
                    className: (0, o.cn)("flex cursor-default items-center justify-center py-1", r),
                    ...s,
                    children: (0, a.jsx)(i.g8U, {})
                })
            });
            p.displayName = n.u_.displayName;
            let f = s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, a.jsx)(n.$G, {
                    ref: t,
                    className: (0, o.cn)("flex cursor-default items-center justify-center py-1", r),
                    ...s,
                    children: (0, a.jsx)(i.v4q, {})
                })
            });
            f.displayName = n.$G.displayName;
            let m = s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    position: i = "popper",
                    ...l
                } = e;
                return (0, a.jsx)(n.h_, {
                    children: (0, a.jsxs)(n.VY, {
                        ref: t,
                        className: (0, o.cn)("relative z-[150] border border-input-border max-h-96 min-w-[8rem] overflow-hidden rounded-xl bg-card-bg text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", "popper" === i && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", r),
                        position: i,
                        ...l,
                        children: [(0, a.jsx)(p, {}), (0, a.jsx)(n.l_, {
                            className: (0, o.cn)("p-1", "popper" === i && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
                            children: s
                        }), (0, a.jsx)(f, {})]
                    })
                })
            });
            m.displayName = n.VY.displayName;
            let h = s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, a.jsx)(n.__, {
                    ref: t,
                    className: (0, o.cn)("px-2 py-1.5 text-sm font-semibold text-muted-foreground", r),
                    ...s
                })
            });
            h.displayName = n.__.displayName;
            let x = s.forwardRef((e, t) => {
                let {
                    className: r,
                    children: s,
                    ...l
                } = e;
                return (0, a.jsxs)(n.ck, {
                    ref: t,
                    onClick: e => {
                        e.stopPropagation()
                    },
                    className: (0, o.cn)("relative flex w-full cursor-default select-none rounded-lg items-center py-2 pl-3 pr-8 text-sm outline-none focus:bg-blue-600/30 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[active]:bg-blue-600/20", r),
                    ...l,
                    children: [(0, a.jsx)("span", {
                        className: "absolute right-2 flex h-3.5 w-3.5 items-center justify-center",
                        children: (0, a.jsx)(n.wU, {
                            children: (0, a.jsx)(i.nQG, {
                                className: "h-4 w-4 mt-1"
                            })
                        })
                    }), (0, a.jsx)(n.eT, {
                        children: s
                    })]
                })
            });
            x.displayName = n.ck.displayName, s.forwardRef((e, t) => {
                let {
                    className: r,
                    ...s
                } = e;
                return (0, a.jsx)(n.Z0, {
                    ref: t,
                    className: (0, o.cn)("-mx-1 my-1 h-px bg-muted", r),
                    ...s
                })
            }).displayName = n.Z0.displayName, s.forwardRef((e, t) => {
                let {
                    children: r,
                    className: l,
                    ...d
                } = e, [c, u] = s.useState(!1);
                return (0, a.jsx)(n.fC, {
                    open: c,
                    onOpenChange: u,
                    ...d,
                    children: (0, a.jsxs)(n.xz, {
                        onPointerDown: e => e.preventDefault(),
                        onClick: () => {
                            u(e => !e)
                        },
                        ref: t,
                        className: (0, o.cn)("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-4 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none  disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", "bg-input-bg rounded-2xl sm:rounded-xl border text-xs border-input-border overflow-hidden w-full h-11", l),
                        children: [r, (0, a.jsx)(n.JO, {
                            asChild: !0,
                            children: (0, a.jsx)(i.v4q, {
                                className: "h-4 w-4 opacity-50"
                            })
                        })]
                    })
                })
            }).displayName = "SelectWithTrigger"
        },
        79772: function(e, t, r) {
            r.d(t, {
                i: function() {
                    return u
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(34707),
                n = r(34586),
                o = r.n(n),
                l = r(58685);
            let d = (e, t, r, a, s) => {
                    if (!e || e.length < 2) return e;
                    let i = a * s,
                        n = Math.min(t, r),
                        o = Math.max(t, r),
                        [l, d] = [...e].sort((e, t) => e - t);
                    return l = Math.max(n, Math.min(o, l)), (d = Math.max(n, Math.min(o, d))) - l < i && (l = Math.max(n, (d = Math.min(o, l + i)) - i)), [l, d, ...e.slice(2)]
                },
                c = (e, t, r, a, s, i, n) => {
                    if (e.length < 2) return e;
                    let o = i * n,
                        l = Math.min(a, s),
                        c = Math.max(a, s),
                        u = d(t, a, s, i, n),
                        p = e.map(e => Math.max(l, Math.min(c, e)));
                    if (!u || u.length < 2) {
                        var f;
                        return null !== (f = d(p, a, s, i, n)) && void 0 !== f ? f : p
                    }
                    if (0 === (null != r ? r : Math.abs(p[0] - u[0]) > Math.abs(p[1] - u[1]) ? 0 : 1)) {
                        let e = u[1];
                        return [Math.min(p[0], e - o), e, ...p.slice(2)]
                    }
                    let m = u[0];
                    return [m, Math.max(p[1], m + o), ...p.slice(2)]
                },
                u = s.forwardRef((e, t) => {
                    var r, n;
                    let {
                        className: u,
                        sport: p,
                        onValueChange: f,
                        debounceMs: m = 100,
                        hideThumbLabels: h = !1,
                        min: x = 0,
                        max: g = 100,
                        step: b = 1,
                        minStepsBetweenThumbs: v = 1,
                        ...y
                    } = e, w = s.useMemo(() => f && (m > 0 ? o()(f, m) : f), [f, m]), [N, j] = s.useState(d(null !== (n = y.value) && void 0 !== n ? n : y.defaultValue, x, g, b, v)), k = s.useRef(N), C = s.useRef(null), _ = s.useCallback(e => {
                        k.current = e, j(e)
                    }, []);
                    return s.useEffect(() => {
                        if (y.value) {
                            _(d(y.value, x, g, b, v));
                            return
                        }
                        y.defaultValue && _(d(y.defaultValue, x, g, b, v))
                    }, [g, x, v, y.value, y.defaultValue, _, b]), (0, a.jsxs)(i.fC, { ...y,
                        ref: t,
                        value: N,
                        onValueChange: e => {
                            let t = c(e, k.current, C.current, x, g, b, v);
                            _(t), null == w || w(t)
                        },
                        min: x,
                        max: g,
                        step: b,
                        minStepsBetweenThumbs: v,
                        className: (0, l.cn)("relative flex w-full touch-none select-none items-center", u),
                        children: [(0, a.jsx)(i.fQ, {
                            className: "relative h-2 w-full grow overflow-hidden rounded-full bg-border/50",
                            children: (0, a.jsx)(i.e6, {
                                className: "absolute h-full bg-blue-500/60"
                            })
                        }), null === (r = null != N ? N : y.defaultValue) || void 0 === r ? void 0 : r.map((e, t) => (0, a.jsx)(i.bU, {
                            "aria-label": "slider thumb",
                            onPointerDown: () => {
                                C.current = t
                            },
                            onPointerUp: () => {
                                C.current = null
                            },
                            onFocus: () => {
                                C.current = t
                            },
                            onBlur: () => {
                                C.current = null
                            },
                            className: "block h-5 w-5 rounded-full bg-button border-2 border-blue-500 shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50",
                            children: !h && (0, a.jsx)("span", {
                                className: "absolute mt-6 text-muted-foreground text-xs whitespace-nowrap",
                                children: e
                            })
                        }, t))]
                    })
                });
            u.displayName = i.fC.displayName
        },
        13881: function(e, t, r) {
            r.d(t, {
                c: function() {
                    return N
                },
                r: function() {
                    return j
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(7357),
                n = r(69948),
                o = r(69237),
                l = r(6672),
                d = r(72044);
            async function c(e, t, r, a) {
                let s = "true" === d.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app",
                    i = await r(),
                    n = await fetch("".concat(s).concat(e), {
                        method: t,
                        headers: {
                            "Content-Type": "application/json",
                            ...i && {
                                Authorization: "Bearer ".concat(i)
                            }
                        },
                        body: a ? JSON.stringify(a) : void 0
                    }),
                    o = await n.json();
                if (200 !== n.status) throw Error(o.error || o.message || "An error occurred");
                return o
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
                h = r(8933),
                x = r(28876),
                g = r(34772),
                b = r(59160),
                v = r(52924),
                y = r(72044);
            let w = (0, s.createContext)({}),
                N = e => {
                    var t;
                    let {
                        children: r
                    } = e, {
                        open: d,
                        openMobile: c,
                        isMobile: N,
                        toggleSidebar: j
                    } = (0, l.Ap)(), {
                        getToken: k
                    } = (0, n.y)(), C = "true" === y.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app", {
                        user: _,
                        isLoaded: P,
                        isSignedIn: F
                    } = (0, o.aF)(), {
                        isWebViewApp: L
                    } = (0, b.B)(), $ = null == _ ? void 0 : null === (t = _.publicMetadata) || void 0 === t ? void 0 : t.plan, I = (0, x.nt)($), B = I && (d && !N || c), [R, A] = (0, s.useState)(!1), {
                        data: E,
                        mutate: S
                    } = (0, m.Z)(I ? "".concat(C, "/props/favorites") : null, {
                        revalidateOnMount: !1,
                        revalidateOnFocus: !1,
                        revalidateOnReconnect: !1
                    }), M = (0, s.useRef)(!1), [T, D] = (0, s.useState)(!1);
                    (0, s.useEffect)(() => {
                        D(!0)
                    }, []), (0, s.useEffect)(() => {
                        var e;
                        if (!P || !I) return;
                        let t = null == _ ? void 0 : null === (e = _.unsafeMetadata) || void 0 === e ? void 0 : e.favorites,
                            r = void 0 !== t,
                            a = t && Object.keys(t).length > 0;
                        (!r || a) && B && !M.current && T && (M.current = !0, S())
                    }, [d, c, P, _, S, T, I]), (0, s.useEffect)(() => {
                        var e, t;
                        if (!P || !_ || !I || void 0 === E) return;
                        let r = {};
                        for (let e of E) {
                            let t = e.prop.groupKey;
                            t && (r[t] = e.id)
                        }
                        let a = null !== (t = null === (e = _.unsafeMetadata) || void 0 === e ? void 0 : e.favorites) && void 0 !== t ? t : void 0;
                        a && Object.keys(a).length === Object.keys(r).length && Object.keys(r).every(e => a[e] === r[e]) || (_.update({
                            unsafeMetadata: { ..._.unsafeMetadata,
                                favorites: r
                            }
                        }), Z(r))
                    }, [E, P, _, I]);
                    let [z, O] = (0, s.useState)(!1), [G, Z] = (0, s.useState)({});
                    (0, s.useEffect)(() => {
                        if (P) {
                            var e;
                            Z(I && (null == _ ? void 0 : null === (e = _.unsafeMetadata) || void 0 === e ? void 0 : e.favorites) || {})
                        }
                    }, [P, _, I]);
                    let K = (0, s.useCallback)(() => {
                            let e = (0, g.cz)({
                                isSignedIn: F,
                                plan: $,
                                isPwa: L,
                                isWebView: L
                            });
                            g.co.trackFavoritePaywallTriggered({
                                source: "favorite",
                                featureName: "Pick Builder",
                                ...e
                            }), g.co.trackPickBuilderPaywallTriggered({
                                source: "pick_builder",
                                featureName: "Pick Builder",
                                ...e
                            })
                        }, [F, L, $]),
                        U = (0, s.useCallback)(() => !!P && (!!_ && !!I || (K(), A(!0), !1)), [I, P, K, _]),
                        W = (0, s.useCallback)(async (e, t) => {
                            if (!U()) return !1;
                            if (O(!0), G[e.groupKey]) return O(!1), !1;
                            if (Object.keys(G).length >= 50) return i.Am.warning("Maximum ".concat(50, " props allowed")), O(!1), !1;
                            try {
                                let r = await u(e, t, k);
                                S(function() {
                                    let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                    return [...e, r.favorite]
                                }, {
                                    revalidate: !1
                                }), i.Am.success("Added to your Pick Builder!");
                                let a = { ...G,
                                    [e.groupKey]: r.favorite.id
                                };
                                return Z(a), await (null == _ ? void 0 : _.update({
                                    unsafeMetadata: { ...null == _ ? void 0 : _.unsafeMetadata,
                                        favorites: a
                                    }
                                })), N && j(), window.setTimeout(() => {
                                    (0, v.N)()
                                }, 1500), !0
                            } catch (e) {
                                return console.error(e), i.Am.error(e instanceof Error ? e.message : "Failed to add favorite"), !1
                            } finally {
                                O(!1)
                            }
                        }, [G, _, k, U, S, N, j]),
                        V = (0, s.useCallback)(async e => {
                            if (U()) {
                                O(!0);
                                try {
                                    let t = G[e];
                                    if (!t) {
                                        i.Am.error("Favorite not found");
                                        return
                                    }
                                    await p(t, k), S(function() {
                                        let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                        return e.filter(e => e.id !== t)
                                    }, {
                                        revalidate: !1
                                    });
                                    let {
                                        [e]: r, ...a
                                    } = G;
                                    Z(a), await (null == _ ? void 0 : _.update({
                                        unsafeMetadata: { ...null == _ ? void 0 : _.unsafeMetadata,
                                            favorites: a
                                        }
                                    }))
                                } catch (e) {
                                    console.error(e), i.Am.error(e instanceof Error ? e.message : "Failed to remove favorite")
                                } finally {
                                    O(!1)
                                }
                            }
                        }, [G, _, k, U, S]),
                        Y = (0, s.useCallback)(async e => {
                            if (U()) {
                                O(!0);
                                try {
                                    e.prop_key && !G[e.prop_key] && (null == _ || _.update({
                                        unsafeMetadata: { ...null == _ ? void 0 : _.unsafeMetadata,
                                            favorites: { ...G,
                                                [e.prop_key]: e.id
                                            }
                                        }
                                    })), await f(e, k), S(function() {
                                        let t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [];
                                        return t.map(t => t.id === e.id ? e : t)
                                    }, {
                                        revalidate: !1
                                    })
                                } catch (e) {
                                    console.error(e), i.Am.error(e instanceof Error ? e.message : "Failed to update favorite")
                                } finally {
                                    O(!1)
                                }
                            }
                        }, [G, _, k, U, S]);
                    return (0, a.jsxs)(w.Provider, {
                        value: {
                            favorites: I && E || [],
                            favoritesLoading: z,
                            favoriteIdToFavorite: I ? G : {},
                            addFavorite: W,
                            removeFavorite: V,
                            updateFavorite: Y
                        },
                        children: [r, (0, a.jsx)(h.Ei, {
                            open: R,
                            onOpenChange: A,
                            featureName: "Pick Builder",
                            title: "Unlock Pick Builder",
                            description: "Favoriting props and building cards is a premium PickFinder feature.",
                            benefits: x.vR.pickBuilder,
                            source: "pick_builder"
                        })]
                    })
                },
                j = () => (0, s.useContext)(w)
        },
        36098: function(e, t, r) {
            r.d(t, {
                RT: function() {
                    return d
                },
                Wy: function() {
                    return v
                },
                ir: function() {
                    return b
                },
                lW: function() {
                    return c
                },
                mN: function() {
                    return y
                },
                qi: function() {
                    return l
                }
            });
            var a = r(10131),
                s = r(55185),
                i = r(93630);
            let n = (0, s.createContext)({}),
                o = Object.keys(i.ZP),
                l = {
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

            function h(e, t) {
                try {
                    let r = window.localStorage.getItem(e);
                    if (!r) return t;
                    return JSON.parse(r)
                } catch (r) {
                    return console.warn('Error reading localStorage key "'.concat(e, '":'), r), t
                }
            }

            function x(e, t) {
                try {
                    window.localStorage.setItem(e, JSON.stringify(t))
                } catch (t) {
                    console.warn('Error writing localStorage key "'.concat(e, '":'), t)
                }
            }
            let g = () => ({
                    search: "",
                    games: [],
                    page: 1,
                    stats: [],
                    teams: [],
                    playerPage: 1,
                    playerSearch: "",
                    playerTeam: ""
                }),
                b = {
                    appsOrder: i.w$,
                    apps: i.w$,
                    sports: o,
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
                    oddsFilter: { ...l
                    },
                    hitRateFilter: { ...d
                    },
                    tennisRankFilter: { ...c
                    },
                    sportFilters: Object.fromEntries(["all", "mlb", "nfl", "nba", "nhl", "cfb", "cbb", "wnba", "soccer", "tennis", "cod", "cs2", "val", "dota2", "lol"].map(e => [e, g()]))
                },
                v = e => {
                    let {
                        children: t
                    } = e, [r, i] = (0, s.useState)(b);
                    (0, s.useEffect)(() => {
                        let e = function() {
                            let e = h(f, {}),
                                t = null == e ? void 0 : e.pushProps,
                                r = "hide" === t || "only" === t ? t : "all";
                            return void 0 === t && (null == e ? void 0 : e.hidePushProps) === !0 && (r = "hide"), {
                                showAltLines: (null == e ? void 0 : e.showAltLines) === !0,
                                pushProps: r
                            }
                        }();
                        i(t => ({ ...t,
                            oddsFilter: function() {
                                let e = h(u, {}),
                                    t = "app" === e.oddsSource || "best" === e.oddsSource ? e.oddsSource : "best",
                                    r = "over" === e.oddsSide || "under" === e.oddsSide || "either" === e.oddsSide ? e.oddsSide : "either";
                                return { ...l,
                                    minOdds: "string" == typeof e.minOdds ? e.minOdds : "",
                                    maxOdds: "string" == typeof e.maxOdds ? e.maxOdds : "",
                                    oddsSource: t,
                                    oddsApp: "string" == typeof e.oddsApp ? e.oddsApp : "",
                                    oddsSide: r
                                }
                            }(),
                            hitRateFilter: function() {
                                let e = h(p, {}),
                                    t = Array.isArray(e.columns) ? e.columns.filter(e => "string" == typeof e) : [],
                                    r = "string" == typeof e.min ? e.min : "",
                                    a = "string" == typeof e.max ? e.max : "",
                                    s = "0" === r.trim() && "0" === a.trim();
                                return { ...d,
                                    min: s ? t.length > 0 ? "0" : "" : r,
                                    max: s ? t.length > 0 ? "100" : "" : a,
                                    columns: t
                                }
                            }(),
                            showAltLines: e.showAltLines,
                            pushProps: e.pushProps
                        }))
                    }, []);
                    let o = (e, t) => t && e[t] ? { ...e,
                            [t]: { ...e[t],
                                page: 1
                            }
                        } : e,
                        c = (0, s.useCallback)((e, t, r) => {
                            i(a => {
                                if (a[e] === t && !r) return a;
                                let s = a.sportFilters;
                                if (r) {
                                    let e = { ...a.sportFilters[r],
                                        page: 1
                                    };
                                    s = { ...a.sportFilters,
                                        [r]: e
                                    }
                                }
                                return a[e] === t && s === a.sportFilters ? a : ("oddsFilter" === e && x(u, t), "hitRateFilter" === e && x(p, t), ("showAltLines" === e || "pushProps" === e) && x(f, {
                                    showAltLines: "showAltLines" === e ? t : a.showAltLines,
                                    pushProps: "pushProps" === e ? t : a.pushProps
                                }), { ...a,
                                    [e]: t,
                                    sportFilters: s
                                })
                            })
                        }, []),
                        v = (0, s.useCallback)((e, t) => {
                            i(r => ({ ...r,
                                sportFilters: { ...r.sportFilters,
                                    [e]: { ...r.sportFilters[e] || g(),
                                        ...t
                                    }
                                }
                            }))
                        }, []),
                        y = (0, s.useCallback)((e, t, r) => {
                            if ("page" === t || "playerPage" === t) {
                                v(e, {
                                    [t]: r
                                });
                                return
                            }
                            v(e, {
                                [t]: r,
                                ..."playerSearch" !== t && "playerTeam" !== t ? {
                                    page: 1
                                } : {}
                            }), ("playerSearch" === t || "playerTeam" === t) && v(e, {
                                playerPage: 1
                            })
                        }, [v]),
                        w = (0, s.useCallback)((e, t) => {
                            i(r => {
                                let a = { ...r.oddsFilter,
                                    ...e
                                };
                                return x(u, a), { ...r,
                                    oddsFilter: a,
                                    sportFilters: o(r.sportFilters, t)
                                }
                            })
                        }, []),
                        N = (0, s.useCallback)((e, t) => {
                            i(r => {
                                let a = { ...r.hitRateFilter,
                                    ...e
                                };
                                return x(p, a), { ...r,
                                    hitRateFilter: a,
                                    sportFilters: o(r.sportFilters, t)
                                }
                            })
                        }, []),
                        j = (0, s.useCallback)((e, t) => {
                            i(r => ({ ...r,
                                tennisRankFilter: { ...r.tennisRankFilter,
                                    ...e
                                },
                                sportFilters: o(r.sportFilters, t)
                            }))
                        }, []),
                        k = (0, s.useCallback)((e, t) => {
                            x(u, t.oddsFilter), x(p, t.hitRateFilter), i(r => (x(f, {
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
                                    [e]: { ...r.sportFilters[e] || g(),
                                        stats: [...t.stats],
                                        page: 1
                                    }
                                }
                            }))
                        }, []);
                    return (0, a.jsx)(n.Provider, {
                        value: {
                            userFilters: r,
                            setUserFilter: c,
                            setSportFilter: y,
                            setOddsFilter: w,
                            setHitRateFilter: N,
                            setTennisRankFilter: j,
                            applyPropPresetFilters: k,
                            resetFilters: () => {
                                x(u, l), x(p, d), x(f, m), i(b)
                            },
                            initialFilters: b
                        },
                        children: t
                    })
                },
                y = () => (0, s.useContext)(n)
        },
        4695: function(e, t, r) {
            r.d(t, {
                J: function() {
                    return i
                }
            });
            var a = r(87743),
                s = r(93630);

            function i() {
                return (0, a._)("appsOrder", s.w$, {
                    deserializer: e => {
                        if ("undefined" === e || null === e || "" === e) return s.w$;
                        try {
                            let t = JSON.parse(e),
                                r = Array.isArray(t) ? t : null;
                            return function(e, t) {
                                if (!e || !Array.isArray(e) || 0 === e.length) return t;
                                let r = new Set(t),
                                    a = e.filter(e => "string" == typeof e && r.has(e)),
                                    s = t.filter(e => !a.includes(e));
                                return [...a, ...s]
                            }(r, s.w$)
                        } catch (e) {
                            return s.w$
                        }
                    }
                })
            }
        },
        88773: function(e, t, r) {
            r.d(t, {
                i: function() {
                    return s
                }
            });
            var a = r(72044);

            function s(e) {
                let t = a.env.NEXT_PUBLIC_INTERNAL_API_TOKEN;
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
            function a() {
                var e, t, r, a;
                let s = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
                    i = null !== (a = null === (r = window.webkit) || void 0 === r ? void 0 : null === (t = r.messageHandlers) || void 0 === t ? void 0 : t.requestReview) && void 0 !== a ? a : null;
                if (!i) return !1;
                let n = null !== (e = s.storageKey) && void 0 !== e ? e : "pickfinder:native-review:last-requested-at",
                    o = s.cooldownMs;
                if (void 0 !== o && ! function(e, t) {
                        try {
                            let r = Number(window.localStorage.getItem(e));
                            if (!Number.isFinite(r) || r <= 0) return !0;
                            return Date.now() - r >= t
                        } catch (e) {
                            return !0
                        }
                    }(n, o)) return !1;
                try {
                    return i.postMessage({
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
                return a({ ...e,
                    cooldownMs: 2592e6
                })
            }
            r.d(t, {
                N: function() {
                    return a
                },
                v: function() {
                    return s
                }
            })
        },
        54308: function(e, t, r) {
            r.d(t, {
                p: function() {
                    return a
                }
            });
            let a = {
                dabble: {
                    amount: "$25",
                    offerText: "Free $25 by signing up!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/220981?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Dabble",
                    description: "Get $25 free just for signing up!"
                },
                underdog: {
                    amount: "$50",
                    offerText: "Play $5, Get $50 in Bonus Entries!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/90402?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Underdog",
                    description: "Play $5, Get $50 in Bonus Entries!"
                },
                dkpick6: {
                    amount: "$50",
                    offerText: "New Customers Play $5 Get $50 in Bonus Bets Instantly",
                    offerLink: "https://affiliates.routy.app/route/110093?affId=10159&ts=5005202",
                    isLive: !0,
                    disclaimer: "Gambling Problem? Call 1-800-GAMBLER. Help is available for problem gambling. Call (888) 789-7777 or visit ccpg.org (CT). 18+ (19+ AL/NE, 21+ AZ/MA/VA). Valid only where Pick6 operates, see dkng.co/pick6states. Void in NY, ONT, and where prohibited. Eligibility restrictions apply. 1 per new Pick6 customer. $5+ first paid Pick Set to receive max. $50 issued as non-withdrawable Bonus Picks that expire in 14 days (336 hours). Ends 10/13/25 at 11:59 PM ET. Terms: pick6.draftkings.com/promos. Sponsored by DraftKings.",
                    appName: "DK Pick6",
                    description: "New Customers Play $5 Get $50 in Bonus Bets Instantly"
                },
                sleeper: {
                    amount: "$100",
                    offerText: "Get up to a $100 Deposit Match!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/89905?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Sleeper",
                    description: "Fantasy sports platform offering deposit match bonuses for new users."
                },
                prizepicks: {
                    amount: "$50",
                    offerText: "Play $5, get $50 instantly",
                    promoCode: "PR-9YPBBGR",
                    offerLink: "https://app.prizepicks.com/sign-up?invite_code=PR-9YPBBGR&source=prizepicks&medium=user_referral&campaign=e885378f-8c7a-4fcd-9b4b-3621250c9ea5&content=promotions",
                    isLive: !0,
                    appName: "PrizePicks",
                    description: "Daily fantasy sports platform with instant bonus when you play."
                },
                chalkboard: {
                    amount: "$20",
                    offerText: "$20 Free on sign-up!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://www.vaultsportshq.com/chalkboard-links/pickfinder",
                    isLive: !0,
                    appName: "Chalkboard",
                    description: "$20 Free on sign-up!"
                },
                fliff: {
                    amount: "$100",
                    offerText: "Spend $50, get up to $100 in Fliff Coins!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/109133?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Fliff",
                    description: "Spend $50, get up to $100 in Fliff Coins!"
                },
                draftkings: {
                    amount: "$200",
                    offerText: "Bet $5 Get $200 in Bonus Bets Instantly AND $200 Off NFL Sunday Ticket!",
                    offerLink: "https://affiliates.routy.app/route/108964?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "DraftKings",
                    description: "Bet $5 Get $200 in Bonus Bets Instantly AND $200 Off NFL Sunday Ticket!"
                },
                fanduel: {
                    amount: "$150",
                    offerText: "Bet $5 Get $150 in Bonus Bets If Your Bet Wins!",
                    offerLink: "https://affiliates.routy.app/route/111321?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "FanDuel",
                    description: "Bet $5 Get $150 in Bonus Bets If Your Bet Wins!"
                },
                caesars: {
                    amount: "2X",
                    offerText: "Bet $1, Double Your Winnings Your Next 20 Bets!",
                    promoCode: "VAULT27250BM",
                    offerLink: "https://affiliates.routy.app/route/237729?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Caesars",
                    description: "Bet $1, Double Your Winnings Your Next 20 Bets!"
                },
                betmgm: {
                    amount: "$150",
                    offerText: "Bet $10 Get $150 If You Win Your First Bet!",
                    promoCode: "PFINDER",
                    offerLink: "https://affiliates.routy.app/route/120474?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "BetMGM",
                    description: "Bet $10 Get $150 If You Win Your First Bet!"
                },
                parlayplay: {
                    amount: "$105",
                    offerText: "Free $5 at Sign Up + Up to $100 Deposit Match!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/93507?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "ParlayPlay",
                    description: "Get a free $5 bonus and deposit match up to $100 when you sign up."
                },
                betr: {
                    amount: "$200",
                    offerText: "Free $10 after signing up + a 50% Deposit Match, up to $200!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/128761?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Betr",
                    description: "Free $10 after signing up + a 50% Deposit Match, up to $200!"
                },
                rebet: {
                    amount: "$100",
                    offerText: "Get a 100% purchase match up to $100!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/110283?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "ReBet",
                    description: "Get a 100% purchase match up to $100!"
                },
                novig: {
                    amount: "$50",
                    offerText: "Spend $5 Get $50 in Novig Coins!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/108885?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Novig",
                    description: "Spend $5 Get $50 in Novig Coins!"
                },
                prophetx: {
                    amount: "$25",
                    offerText: "Purchase $25 and Get $25 in Prophet Cash!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/357561?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "ProphetX",
                    description: "Purchase $25 and Get $25 in Prophet Cash!"
                },
                kalshi: {
                    amount: "$500",
                    offerText: "Trade $25 and get up to $500!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/151242?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Kalshi",
                    description: "Certain limitations apply. The offer is available to new users only, subject to the terms and conditions at http://kalshi.com/tc/500. 18+ only. Restrictions and eligibility requirements apply. Event contract trading involves significant risk and is not appropriate for everyone. Please carefully consider if it is appropriate for you in light of your personal financial circumstances. Kalshi products are not available in all jurisdictions. See http://kalshi.com/regulatory for more information."
                },
                courtside: {
                    amount: "$50",
                    offerText: "Spend $10, Get 50 in Free Picks!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/434816?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Courtside",
                    description: "Spend $10, Get 50 in Free Picks!"
                },
                polymarket: {
                    amount: "$50",
                    offerText: "Deposit $10 get a $50 Trading Bonus!",
                    promoCode: "PICKFINDER",
                    offerLink: "https://affiliates.routy.app/route/393158?affId=10159&ts=5005202",
                    isLive: !0,
                    appName: "Polymarket",
                    description: "Deposit $10 get a $50 Trading Bonus!"
                }
            }
        },
        14032: function(e, t, r) {
            r.d(t, {
                F: function() {
                    return s
                }
            });
            let a = {
                    "usa_-_major_league_soccer": "MLS",
                    "england_-_premier_league": "Premier League",
                    "spain_-_la_liga": "La Liga",
                    "italy_-_serie_a": "Serie A",
                    "germany_-_bundesliga": "Bundesliga",
                    "france_-_ligue_1": "Ligue 1",
                    "fifa_-_world_cup": "FIFA World Cup",
                    "fifa_-_world_cup_qualifiers": "FIFA World Cup Qualifiers",
                    "uefa_-_champions_league": "UEFA Champions League",
                    "uefa_-_europa_league": "UEFA Europa League",
                    "mexico_-_liga_mx": "Liga MX",
                    "argentina_-_primera_division": "Primera Divisi\xf3n",
                    "argentina_-_copa_argentina": "Copa Argentina",
                    "brazil_-_serie_a": "Brasileir\xe3o",
                    "usa_-_nwsl": "NWSL",
                    "international_-_club_friendlies": "Club Friendlies",
                    "north_america_-_leagues_cup": "Leagues Cup",
                    "saudi_arabia_-_saudi_league": "Saudi Pro League",
                    "england_-_championship": "EFL Championship"
                },
                s = e => {
                    var t;
                    return null !== (t = a[e]) && void 0 !== t ? t : e.split("_-_").map(e => e.split("_").filter(Boolean).map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(" ")).join(" - ")
                }
        },
        71408: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return o
                }
            });
            var a = r(14713),
                s = r(69948),
                i = r(55185),
                n = r(88773);

            function o(e, t) {
                let {
                    getToken: r,
                    isLoaded: o,
                    userId: l
                } = (0, s.y)(), d = !!e && !o, c = (0, i.useCallback)(async e => {
                    let t = await r();
                    if (!t) throw Error("Authentication token is not available.");
                    let a = await fetch(e, {
                        method: "GET",
                        mode: "cors",
                        headers: (0, n.i)(t)
                    });
                    if (!a.ok) throw Error("An error occurred while fetching the data.");
                    return a.json()
                }, [r]), u = (0, a.ZP)(o && l ? e : null, c, t);
                return { ...u,
                    isLoading: d || u.isLoading,
                    isValidating: d || u.isValidating
                }
            }
        },
        38977: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return o
                }
            });
            var a = r(47898),
                s = r(69948),
                i = r(55185),
                n = r(88773);

            function o(e, t) {
                let {
                    getToken: r,
                    isLoaded: o,
                    userId: l
                } = (0, s.y)(), d = !!e && !o, c = (0, i.useCallback)(async e => {
                    let t = await r();
                    if (!t) throw Error("Authentication token is not available.");
                    let a = await fetch(e, {
                        method: "GET",
                        mode: "cors",
                        headers: (0, n.i)(t)
                    });
                    if (!a.ok) throw Error("An error occurred while fetching the data.");
                    return a.json()
                }, [r]), u = (0, a.Z)(o && l ? e : null, c, t);
                return { ...u,
                    isLoading: d || u.isLoading,
                    isValidating: d || u.isValidating
                }
            }
        }
    }
]);