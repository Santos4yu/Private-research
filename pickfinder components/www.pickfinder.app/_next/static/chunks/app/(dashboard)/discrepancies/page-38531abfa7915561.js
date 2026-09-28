(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [1640], {
        76454: function(e, s, i) {
            Promise.resolve().then(i.bind(i, 666)), Promise.resolve().then(i.bind(i, 58520)), Promise.resolve().then(i.bind(i, 74093))
        },
        91367: function(e, s, i) {
            "use strict";
            i.d(s, {
                Z: function() {
                    return r
                }
            });
            let r = (0, i(76188).Z)("ArrowLeftRight", [
                ["path", {
                    d: "M8 3 4 7l4 4",
                    key: "9rb6wj"
                }],
                ["path", {
                    d: "M4 7h16",
                    key: "6tx8e3"
                }],
                ["path", {
                    d: "m16 21 4-4-4-4",
                    key: "siv7j2"
                }],
                ["path", {
                    d: "M20 17H4",
                    key: "h6l3hr"
                }]
            ])
        },
        666: function(e, s, i) {
            "use strict";
            i.d(s, {
                Discrepancies: function() {
                    return F
                }
            });
            var r = i(10131),
                a = i(849),
                l = i(15),
                t = i(63210),
                n = i(47288),
                c = i(55185),
                d = i(29919),
                o = i(66961),
                h = i(91367),
                p = i(70333),
                u = i(39248),
                g = i(14713),
                m = i(69237),
                x = i(94300),
                f = i(87743),
                b = i(4695),
                v = i(46434),
                j = i(36098),
                N = i(77606),
                w = i(6672),
                k = i(26292),
                y = i(69687),
                _ = i(38977),
                D = i(88045),
                C = i(8933),
                Z = i(28876),
                P = i(34772),
                A = i(59160),
                z = i(72044);

            function F() {
                var e;
                let {
                    userFilters: s,
                    initialFilters: i,
                    setUserFilter: d
                } = (0, j.mN)(), {
                    sportsParam: o
                } = (0, l.w)(), {
                    user: h,
                    isLoaded: p,
                    isSignedIn: u
                } = (0, m.aF)(), {
                    isWebViewApp: v
                } = (0, A.B)(), N = null == h ? void 0 : null === (e = h.publicMetadata) || void 0 === e ? void 0 : e.plan, k = (0, Z.nt)(N), y = p && !k, F = (0, c.useRef)(null), {
                    openUpgradeDialog: E,
                    upgradeDialog: M
                } = (0, C.Mz)({
                    featureName: "Discrepancies",
                    title: "Unlock More Discrepancies",
                    description: "Compare every line gap with full filters, player pages, and our premium Discord with admin picks.",
                    benefits: Z.vR.discrepancies,
                    source: "discrepancies"
                }), [R, U] = (0, f._)("apps", i.apps), S = "true" === z.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app", {
                    data: V,
                    isLoading: I,
                    mutate: J,
                    error: T
                } = (0, _.Z)(p && k ? function() {
                    let e = R.length === i.apps.length ? [] : R,
                        r = (0, x.s)({
                            sports: o,
                            apps: e,
                            sort: s.sortDiscrepancies
                        });
                    return "".concat(S, "/discrepancies?").concat(r)
                }() : null, {
                    keepPreviousData: !0,
                    revalidateOnFocus: !1,
                    revalidateOnReconnect: !0
                }), {
                    data: X,
                    isLoading: q,
                    mutate: B,
                    error: W
                } = (0, g.ZP)(y ? "".concat(S, "/public/discrepancies") : null, D.Z, {
                    keepPreviousData: !0,
                    revalidateOnFocus: !1,
                    revalidateOnReconnect: !0
                }), H = e => {
                    d("sortDiscrepancies", e)
                };
                (0, c.useEffect)(() => {
                    s.sortDiscrepancies || d("sortDiscrepancies", "-diffPercent")
                }, [s.sortDiscrepancies, d]);
                let [K, $] = (0, b.J)(), {
                    isMobile: G
                } = (0, w.Ap)(), Q = y ? X : V, Y = (null == Q ? void 0 : Q.items) || [], ee = !p || (y ? q : I), es = y ? W : T, ei = y ? B : J, er = o || "all", ea = (0, c.useCallback)(function() {
                    let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                    return {
                        source: "discrepancies",
                        page: "/discrepancies",
                        sport: er,
                        ...(0, P.cz)({
                            isSignedIn: u,
                            plan: N,
                            isPwa: v,
                            isWebView: v
                        }),
                        ...e
                    }
                }, [u, v, N, er]), el = (0, c.useCallback)(e => {
                    P.co.trackLockedFilterClicked(ea({
                        trigger: e
                    })), E()
                }, [ea, E]), et = (0, c.useCallback)(() => el("discrepancies_locked_content"), [el]), en = (0, c.useCallback)(() => el("filters"), [el]);
                return (0, c.useEffect)(() => {
                    if (!y || !X) return;
                    let e = X.items.length,
                        s = "".concat(er, ":").concat(e, ":").concat(X.totalItems, ":").concat(u ? "signed-in" : "signed-out", ":").concat(null != N ? N : "None", ":").concat(v ? "pwa" : "web");
                    F.current !== s && (F.current = s, P.co.trackFreemiumDiscrepanciesViewed(ea({
                        item_count: e,
                        total_items: X.totalItems
                    })))
                }, [ea, u, v, X, y, N, er]), (0, r.jsxs)(r.Fragment, {
                    children: [(0, r.jsx)("div", {
                        "aria-disabled": y,
                        onClickCapture: y ? e => {
                            e.preventDefault(), e.stopPropagation(), en()
                        } : void 0,
                        children: (0, r.jsx)("div", {
                            className: (0, t.Z)("grid grid-cols-1 gap-2", y && "pointer-events-none select-none"),
                            children: (0, r.jsxs)("div", {
                                className: "flex items-center gap-2",
                                children: [(0, r.jsx)("div", {
                                    className: "flex-1 min-w-0",
                                    children: (0, r.jsx)(a.N, {
                                        enableOnlyAction: !0,
                                        displayOrder: K,
                                        options: K.map(e => ({
                                            label: i.appMap[e] || e,
                                            value: e,
                                            icon: (0, r.jsx)(n.Z, {
                                                appName: e,
                                                size: 20
                                            }, "".concat(e, "-filter"))
                                        })),
                                        draggable: !0,
                                        onOptionsReorder: e => {
                                            $(e.map(e => e.value))
                                        },
                                        selectedValues: R,
                                        onValueChange: U,
                                        allValues: i.apps || [],
                                        placeholder: "Min-Line Apps",
                                        variant: "secondary",
                                        maxCount: G ? 2 : 4
                                    })
                                }), (0, r.jsx)("div", {
                                    className: "flex shrink-0",
                                    children: (0, r.jsx)(L, {
                                        sortSetting: s.sortDiscrepancies,
                                        setDiffSort: e => {
                                            (s.sortDiscrepancies || "").replace("-", "") !== e && H("-" + e)
                                        }
                                    })
                                })]
                            })
                        })
                    }), (0, r.jsx)(O, {
                        discrepancies: Y,
                        isLoading: ee,
                        hasData: !!Q,
                        error: es,
                        mutate: ei,
                        isPublicPreview: y,
                        onUpgrade: et
                    }), M]
                })
            }
            let L = (0, c.memo)(function(e) {
                    let {
                        sortSetting: s,
                        setDiffSort: i
                    } = e, a = (s || "").replace("-", ""), l = "difference" === a || "diffPercent" === a;
                    return (0, r.jsxs)(v.h_, {
                        children: [(0, r.jsx)(v.$F, {
                            asChild: !0,
                            children: (0, r.jsxs)(y.z, {
                                variant: "secondary",
                                className: (0, t.Z)("h-11 rounded-xl text-xs border transition-colors duration-200 flex items-center gap-2 bg-gradient-to-b from-highlight/70 to-highlight/30 hover:from-highlight/80 hover:to-highlight/40 px-3.5", l ? "border-button" : "border-input"),
                                "aria-label": "Sort discrepancies by difference",
                                children: [(0, r.jsx)(d.Z, {
                                    className: (0, t.Z)("w-4 h-4", l ? "text-button" : "text-muted-foreground")
                                }), (0, r.jsx)("span", {
                                    className: (0, t.Z)("text-xs", l ? "text-foreground" : "text-muted-foreground"),
                                    children: "diffPercent" === a ? "Diff %" : "Diff"
                                })]
                            })
                        }), (0, r.jsxs)(v.AW, {
                            className: "bg-new-bg",
                            children: [(0, r.jsx)(v.Ju, {
                                children: "Sort"
                            }), (0, r.jsx)(v.VD, {}), (0, r.jsx)(v.Xi, {
                                onClick: () => i("difference"),
                                className: (0, t.Z)("difference" === a && "bg-highlight"),
                                children: "Diff"
                            }), (0, r.jsx)(v.Xi, {
                                onClick: () => i("diffPercent"),
                                className: (0, t.Z)("diffPercent" === a && "bg-highlight"),
                                children: "Diff %"
                            })]
                        })]
                    })
                }),
                O = (0, c.memo)(function(e) {
                    let {
                        discrepancies: s,
                        isLoading: i,
                        hasData: a,
                        error: l,
                        mutate: t,
                        isPublicPreview: n = !1,
                        onUpgrade: d
                    } = e, {
                        discrepanciesScrollPosition: p
                    } = (0, N.v)(), g = (0, c.useRef)(null), m = n ? Math.max(0, 10 - s.length - 1) : 0, x = i && a && (0, r.jsx)("div", {
                        className: "absolute inset-0 z-20 flex items-center justify-center bg-black/20",
                        children: (0, r.jsx)(o.Z, {
                            className: "h-6 w-6 animate-spin text-button"
                        })
                    });
                    return ((0, c.useEffect)(() => {
                        let e = g.current;
                        e && requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                e.scrollTop = p || 0
                            })
                        })
                    }, []), l) ? (0, r.jsxs)("div", {
                        className: "flex flex-col items-center justify-center py-12 px-4",
                        children: [(0, r.jsx)("p", {
                            className: "text-muted-foreground mb-3",
                            children: "Error getting discrepancies"
                        }), (0, r.jsx)("button", {
                            onClick: () => t(),
                            className: "bg-highlight hover:brightness-90 text-sm px-4 py-2 rounded-lg border border-input",
                            children: "Retry"
                        })]
                    }) : i && !a ? (0, r.jsx)("div", {
                        className: "relative min-h-0 flex-1 overflow-hidden",
                        children: (0, r.jsx)("div", {
                            className: "grid grid-cols-1 md:grid-cols-2 gap-2",
                            children: Array.from({
                                length: 16
                            }).map((e, s) => (0, r.jsx)(M, {}, s))
                        })
                    }) : s && 0 !== s.length ? (0, r.jsxs)("div", {
                        ref: g,
                        id: "discrepancies-list-container",
                        className: "relative overflow-y-auto max-h-[calc(100vh)] custom-scrollbar pb-24 md:pb-0",
                        children: [x, (0, r.jsxs)("div", {
                            className: "grid grid-cols-1 md:grid-cols-2 gap-2",
                            children: [s.map((e, s) => (0, r.jsx)(k.kJ, {
                                discrepancy: e
                            }, "".concat(e.groupKey, "-").concat(s))), n && (0, r.jsx)(E, {
                                onUnlock: () => null == d ? void 0 : d()
                            }), n && Array.from({
                                length: m
                            }).map((e, s) => (0, r.jsx)(M, {
                                locked: !0
                            }, s))]
                        })]
                    }) : (0, r.jsxs)("div", {
                        className: "relative flex min-h-0 flex-1 flex-col overflow-hidden",
                        children: [x, (0, r.jsx)(u.o, {
                            fill: !0,
                            icon: h.Z,
                            title: "No discrepancies",
                            description: "Nothing matches these filters. Try another sport or app.",
                            ghost: (0, r.jsx)("div", {
                                className: "grid grid-cols-1 md:grid-cols-2 gap-2 opacity-60 [&_.animate-pulse]:animate-none",
                                children: Array.from({
                                    length: 16
                                }).map((e, s) => (0, r.jsx)(M, {}, s))
                            })
                        })]
                    })
                });

            function E(e) {
                let {
                    onUnlock: s
                } = e;
                return (0, r.jsxs)("div", {
                    className: "relative overflow-hidden rounded-xl border border-input bg-new-bg p-4",
                    children: [(0, r.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 opacity-35 blur-[1px]",
                        children: (0, r.jsx)(M, {})
                    }), (0, r.jsxs)("div", {
                        className: "relative z-10 flex min-h-[10.5rem] flex-col justify-between gap-4",
                        children: [(0, r.jsxs)("div", {
                            className: "flex items-start gap-3",
                            children: [(0, r.jsx)("div", {
                                className: "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-500/10 text-blue-200",
                                children: (0, r.jsx)(p.Z, {
                                    className: "h-5 w-5"
                                })
                            }), (0, r.jsxs)("div", {
                                className: "min-w-0",
                                children: [(0, r.jsx)("p", {
                                    className: "text-sm font-semibold text-white",
                                    children: "Unlock more discrepancies"
                                }), (0, r.jsx)("p", {
                                    className: "mt-1 text-xs leading-5 text-muted-foreground",
                                    children: "Compare every line gap across books and save the best edges."
                                })]
                            })]
                        }), (0, r.jsxs)(y.z, {
                            type: "button",
                            variant: "blue",
                            className: "h-10 !w-full gap-2 rounded-lg px-5 text-xs",
                            onClick: s,
                            children: [(0, r.jsx)(p.Z, {
                                className: "h-3.5 w-3.5"
                            }), "Sign in to unlock"]
                        })]
                    })]
                })
            }
            let M = (0, c.memo)(function(e) {
                let {
                    locked: s = !1
                } = e;
                return (0, r.jsxs)("div", {
                    className: "relative rounded-xl border border-input bg-new-bg overflow-hidden",
                    children: [(0, r.jsx)("div", {
                        className: "pointer-events-none absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-gray-800 to-new-bg z-10"
                    }), (0, r.jsxs)("div", {
                        className: (0, t.Z)("relative z-20 flex flex-col", s && "opacity-70 blur-[1.5px]"),
                        children: [(0, r.jsxs)("div", {
                            className: "flex items-start justify-between gap-2 px-2.5 pt-2 pb-1",
                            children: [(0, r.jsxs)("div", {
                                className: "flex min-w-0 flex-1 flex-col items-start",
                                children: [(0, r.jsxs)("div", {
                                    className: "flex w-full min-w-0 items-center gap-3 mb-2",
                                    children: [(0, r.jsx)("div", {
                                        className: "w-11 h-11 bg-highlight rounded-full flex-shrink-0"
                                    }), (0, r.jsxs)("div", {
                                        className: "flex flex-col gap-2",
                                        children: [(0, r.jsx)("div", {
                                            className: "h-3 w-28 bg-highlight rounded-full"
                                        }), (0, r.jsx)("div", {
                                            className: "h-3 w-20 bg-highlight rounded-full"
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "flex items-center gap-2 pl-1",
                                    children: [(0, r.jsx)("div", {
                                        className: "h-3 w-28 bg-highlight rounded-full"
                                    }), (0, r.jsx)("div", {
                                        className: "h-3 w-20 bg-highlight rounded-full"
                                    })]
                                })]
                            }), (0, r.jsx)("div", {
                                className: "pt-0.5",
                                children: (0, r.jsx)("div", {
                                    className: "h-8 w-[88px] rounded-lg border border-input bg-highlight/60"
                                })
                            })]
                        }), (0, r.jsx)("div", {
                            className: "pb-1 flex items-center gap-0.5 overflow-hidden",
                            children: Array.from({
                                length: 6
                            }).map((e, s) => (0, r.jsx)("div", {
                                className: "w-20 h-12 bg-highlight/70 border-b border-input rounded-sm"
                            }, s))
                        }), (0, r.jsx)("div", {
                            className: "px-2.5 pt-2 pb-2",
                            children: (0, r.jsxs)("div", {
                                className: "grid grid-cols-2 gap-2",
                                children: [(0, r.jsx)("div", {
                                    className: "rounded-lg border border-input bg-background/40 px-3 py-2",
                                    children: (0, r.jsxs)("div", {
                                        className: "flex flex-col gap-2",
                                        children: [(0, r.jsx)("div", {
                                            className: "h-2.5 w-14 bg-highlight rounded-full"
                                        }), (0, r.jsx)("div", {
                                            className: "h-4 w-24 bg-highlight rounded-full"
                                        })]
                                    })
                                }), (0, r.jsx)("div", {
                                    className: "rounded-lg border border-input bg-background/40 px-3 py-2",
                                    children: (0, r.jsxs)("div", {
                                        className: "flex flex-col gap-2",
                                        children: [(0, r.jsx)("div", {
                                            className: "h-2.5 w-14 bg-highlight rounded-full"
                                        }), (0, r.jsx)("div", {
                                            className: "h-4 w-24 bg-highlight rounded-full"
                                        })]
                                    })
                                })]
                            })
                        })]
                    }), s && (0, r.jsxs)(r.Fragment, {
                        children: [(0, r.jsx)("div", {
                            className: "pointer-events-none absolute inset-0 z-30 bg-gradient-to-b from-[#030712]/10 via-[#030712]/58 to-[#030712]/30"
                        }), (0, r.jsx)("div", {
                            className: "pointer-events-none absolute inset-x-8 top-0 z-40 h-px bg-gradient-to-r from-transparent via-blue-300/40 to-transparent"
                        }), (0, r.jsx)("div", {
                            className: "pointer-events-none absolute inset-0 z-40 grid place-items-center",
                            children: (0, r.jsxs)("div", {
                                className: "relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-blue-200/20 bg-[#07111f]/85 text-blue-100 shadow-[0_18px_44px_-22px_rgba(52,97,255,0.95)] backdrop-blur-md",
                                children: [(0, r.jsx)("div", {
                                    className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(96,165,250,0.30),transparent_62%)]"
                                }), (0, r.jsx)("div", {
                                    className: "absolute inset-px rounded-2xl border border-white/[0.04]"
                                }), (0, r.jsx)("span", {
                                    className: "relative grid h-8 w-8 place-items-center rounded-xl bg-blue-500/15 text-blue-100",
                                    children: (0, r.jsx)(p.Z, {
                                        className: "h-4 w-4 drop-shadow-[0_0_12px_rgba(147,197,253,0.55)]"
                                    })
                                })]
                            })
                        })]
                    })]
                })
            })
        }
    },
    function(e) {
        e.O(0, [9732, 5308, 6717, 1069, 6582, 792, 748, 4885, 723, 6825, 9679, 9404, 5331, 4242, 8819, 9479, 4640, 2468, 9596, 6699, 679, 3209, 2261, 7926, 1872, 6741, 1478, 9819, 1163, 1469, 3757, 6381, 3471, 4860, 1592, 8933, 4358, 4174, 4375, 4676, 6292, 5552, 1355, 1744], function() {
            return e(e.s = 76454)
        }), _N_E = e.O()
    }
]);