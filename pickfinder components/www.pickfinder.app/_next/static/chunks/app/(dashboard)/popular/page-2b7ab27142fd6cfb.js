(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [8698], {
        42478: function(e, l, s) {
            Promise.resolve().then(s.bind(s, 20513)), Promise.resolve().then(s.bind(s, 58520)), Promise.resolve().then(s.bind(s, 74093))
        },
        20513: function(e, l, s) {
            "use strict";
            s.d(l, {
                default: function() {
                    return U
                }
            });
            var a = s(10131),
                i = s(55185),
                t = s(63210),
                r = s(88045),
                n = s(14713),
                o = s(47288),
                d = s(8161),
                c = s(69237),
                h = s(77606),
                u = s(87743),
                m = s(4695),
                p = s(849),
                g = s(69687),
                x = s(229),
                f = s(8933),
                v = s(28876),
                b = s(34772),
                j = s(59160),
                N = s(52924),
                w = s(26292),
                k = s(66961),
                y = s(91357),
                _ = s(47068),
                C = s(70333),
                P = s(39248),
                A = s(36098),
                E = s(15),
                F = s(94300),
                L = s(71408),
                T = s(37220),
                Z = s(72044);

            function U() {
                var e;
                let {
                    initialFilters: l
                } = (0, A.mN)(), {
                    sportsParam: s
                } = (0, E.w)(), {
                    trendingScrollPosition: g,
                    setTrendingScrollPosition: x
                } = (0, h.v)(), C = (0, i.useRef)(null), [U] = (0, m.J)(), I = (0, T.a)("(min-width: 640px)"), {
                    user: M,
                    isLoaded: B,
                    isSignedIn: R
                } = (0, c.aF)(), {
                    isWebViewApp: q
                } = (0, j.B)(), D = null == M ? void 0 : null === (e = M.publicMetadata) || void 0 === e ? void 0 : e.plan, W = (0, v.nt)(D), X = B && !W, [J, K] = (0, i.useState)(!1), G = (0, i.useRef)(null), H = (0, i.useRef)(!1), [Q, Y] = (0, u._)("apps", l.apps), [$, ee] = (0, u._)("singleModifier", "any"), el = "true" === Z.env.NEXT_PUBLIC_USE_LOCAL_API ? "http://localhost:3001" : "https://api-v2.pickfinder.app";
                (0, i.useEffect)(() => {
                    let e = C.current;
                    e && requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            e.scrollTop = g || 0
                        })
                    })
                }, []);
                let {
                    data: es,
                    isLoading: ea,
                    error: ei
                } = (0, L.Z)(B && W ? function() {
                    if (!Q || 0 === Q.length) return null;
                    let e = Q.length === l.apps.length ? "" : Q,
                        a = (0, F.s)({
                            sports: s,
                            app: e,
                            ..."any" !== $ && {
                                modifier: $
                            }
                        });
                    return "".concat(el, "/props?").concat(a, "&sort=-max_favorite_count&minFavoriteCount=5&perPage=50&page=1")
                }() : null, {
                    keepPreviousData: !0
                }), {
                    data: et,
                    isLoading: er,
                    error: en
                } = (0, n.ZP)(X ? "".concat(el, "/public/trending") : null, r.Z, {
                    keepPreviousData: !0
                }), eo = X ? et : es, ed = !B || (X ? er : ea), ec = ed && !eo, eh = ed && eo && (0, a.jsx)("div", {
                    className: "absolute inset-0 z-20 flex items-center justify-center bg-black/20",
                    children: (0, a.jsx)(k.Z, {
                        className: "h-6 w-6 animate-spin text-button"
                    })
                }), eu = X ? en : ei, em = (null == eo ? void 0 : eo.items) || [], ep = X ? Math.max(0, ((null == et ? void 0 : et.totalItems) || 0) - em.length) : 0, eg = X ? Math.max(0, 10 - em.length - 1) : 0, ex = R ? "Upgrade to unlock" : "Sign in to unlock", ef = R ? "Upgrade to save" : "Sign in to save", ev = s || "all", eb = (0, i.useCallback)(function() {
                    let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                    return {
                        source: "popular",
                        page: "/popular",
                        sport: ev,
                        ...(0, b.cz)({
                            isSignedIn: R,
                            plan: D,
                            isPwa: q,
                            isWebView: q
                        }),
                        ...e
                    }
                }, [R, q, D, ev]), ej = (0, i.useCallback)(e => {
                    b.co.trackLockedFilterClicked(eb({
                        trigger: e
                    })), R && K(!0)
                }, [eb, R]), eN = (0, i.useCallback)(() => ej("popular_locked_content"), [ej]), ew = (0, i.useCallback)(() => ej("filters"), [ej]), ek = (0, i.useCallback)(() => {
                    if (!B) return;
                    let e = eb({
                        featureName: "Pick Builder",
                        trigger: "favorite"
                    });
                    b.co.trackFavoritePaywallTriggered(e), b.co.trackPickBuilderPaywallTriggered(e), K(!0)
                }, [eb, B]);
                return (0, i.useEffect)(() => {
                    if (!X || !et) return;
                    let e = et.items.length,
                        l = "".concat(ev, ":").concat(e, ":").concat(et.totalItems, ":").concat(R ? "signed-in" : "signed-out", ":").concat(null != D ? D : "None", ":").concat(q ? "pwa" : "web");
                    G.current !== l && (G.current = l, b.co.trackFreemiumPopularViewed(eb({
                        item_count: e,
                        total_items: et.totalItems
                    })))
                }, [eb, R, q, et, X, D, ev]), (0, i.useEffect)(() => {
                    if (!X || !q || !(null == et ? void 0 : et.items.length) || H.current) return;
                    H.current = !0;
                    let e = window.setTimeout(() => {
                        (0, N.v)()
                    }, 1e3);
                    return () => window.clearTimeout(e)
                }, [q, null == et ? void 0 : et.items.length, X]), (0, a.jsxs)(a.Fragment, {
                    children: [(0, a.jsx)("div", {
                        "aria-disabled": X,
                        className: "z-50",
                        onClickCapture: X ? e => {
                            e.preventDefault(), e.stopPropagation(), ew()
                        } : void 0,
                        children: (0, a.jsxs)("div", {
                            className: (0, t.Z)("grid grid-cols-1 gap-2 sm:grid-cols-2", X && "pointer-events-none select-none"),
                            children: [Q && (0, a.jsx)(p.N, {
                                enableOnlyAction: !0,
                                displayOrder: U,
                                options: U.map(e => ({
                                    label: l.appMap[e] || e,
                                    value: e,
                                    icon: (0, a.jsx)(o.Z, {
                                        appName: e,
                                        size: 20
                                    }, "".concat(e, "-filter"))
                                })),
                                selectedValues: Q,
                                onValueChange: Y,
                                allValues: l.apps,
                                placeholder: "Apps",
                                variant: "secondary",
                                maxCount: I ? 7 : 4
                            }), (0, a.jsx)(p.N, {
                                options: l.modifiers.map(e => {
                                    let {
                                        label: l,
                                        icon: s
                                    } = (0, w.jr)(e);
                                    return {
                                        value: e,
                                        label: l,
                                        icon: s
                                    }
                                }),
                                selectedValues: [$],
                                onValueChange: e => {
                                    var l;
                                    return ee(null !== (l = e[0]) && void 0 !== l ? l : "any")
                                },
                                allValues: l.modifiers,
                                placeholder: "Modifier",
                                variant: "secondary",
                                maxSelect: 1,
                                maxCount: 1,
                                hideSelectAll: !0,
                                showTriggerClear: !1
                            })]
                        })
                    }), eu ? (0, a.jsx)("div", {
                        className: "flex flex-col items-center justify-center h-full px-6 mb-24",
                        children: (0, a.jsxs)(d.E.div, {
                            initial: {
                                opacity: 0,
                                y: 12
                            },
                            animate: {
                                opacity: 1,
                                y: 0
                            },
                            transition: {
                                duration: .4,
                                ease: "easeOut"
                            },
                            className: "flex flex-col items-center gap-5 max-w-xs text-center",
                            children: [(0, a.jsx)("div", {
                                className: "relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06] shadow-xl",
                                children: (0, a.jsx)(y.Z, {
                                    className: "w-9 h-9 text-slate-500",
                                    strokeWidth: 1.5
                                })
                            }), (0, a.jsxs)("div", {
                                className: "flex flex-col gap-1.5",
                                children: [(0, a.jsx)("h2", {
                                    className: "text-lg font-semibold text-white tracking-tight",
                                    children: "Couldn't load trending picks"
                                }), (0, a.jsx)("p", {
                                    className: "text-sm text-slate-500 leading-relaxed",
                                    children: "Try refreshing the page — if it keeps happening, reach out to support@pickfinder.app"
                                })]
                            })]
                        })
                    }) : ec ? (0, a.jsx)("div", {
                        className: "relative min-h-0 flex-1 overflow-hidden",
                        children: (0, a.jsx)("div", {
                            className: "grid grid-cols-1 md:grid-cols-2 gap-2 animate-pulse",
                            children: Array.from({
                                length: 16
                            }).map((e, l) => (0, a.jsx)(O, {}, l))
                        })
                    }) : 0 === em.length ? (0, a.jsxs)("div", {
                        className: "relative flex min-h-0 flex-1 flex-col overflow-hidden",
                        children: [eh, (0, a.jsx)(P.o, {
                            fill: !0,
                            icon: _.Z,
                            title: "Nothing trending here",
                            description: "Nothing is trending for these filters. Try another sport or app.",
                            ghost: (0, a.jsx)(S, {})
                        })]
                    }) : (0, a.jsxs)("div", {
                        ref: C,
                        id: "trending-list-container",
                        className: "relative overflow-y-auto max-h-[calc(100vh)] custom-scrollbar",
                        children: [eh, (0, a.jsxs)("div", {
                            className: "grid grid-cols-1 md:grid-cols-2 gap-2 pb-24 md:pb-0",
                            children: [em.map((e, l) => (0, a.jsx)(w.L6, {
                                prop: e,
                                showTrendingCount: !0,
                                isPublicPreview: X,
                                publicFavoriteLabel: ef,
                                onPublicFavorite: ek
                            }, "".concat(encodeURIComponent(e.groupKey), "-").concat(l))), X && (0, a.jsx)(V, {
                                remainingCount: ep,
                                ctaLabel: ex,
                                onUnlock: eN
                            }), X && Array.from({
                                length: eg
                            }).map((e, l) => (0, a.jsx)(z, {}, l))]
                        })]
                    }), (0, a.jsx)(f.Ei, {
                        open: J,
                        onOpenChange: K,
                        featureName: "Popular Props",
                        title: "Unlock the Trending Board",
                        description: "Every trending pick, book comparison, player pages, and our premium Discord with admin picks.",
                        benefits: v.vR.popular,
                        source: "popular"
                    })]
                })
            }

            function V(e) {
                let {
                    remainingCount: l,
                    ctaLabel: s,
                    onUnlock: i
                } = e, {
                    isLoaded: t,
                    isSignedIn: r
                } = (0, c.aF)(), n = (0, a.jsxs)(g.z, {
                    type: "button",
                    variant: "blue",
                    className: "mt-3 h-9 !w-full gap-2 rounded-lg px-4 text-xs",
                    onClick: i,
                    children: [(0, a.jsx)(C.Z, {
                        className: "h-3.5 w-3.5"
                    }), s]
                });
                return (0, a.jsxs)("div", {
                    className: "relative flex min-h-[10.75rem] flex-col overflow-hidden rounded-xl border border-input bg-new-bg p-3",
                    children: [(0, a.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 opacity-40 blur-[1px]",
                        children: (0, a.jsxs)("div", {
                            className: "p-3",
                            children: [(0, a.jsx)("div", {
                                className: "mb-2 h-3.5 w-1/5 rounded-full bg-highlight"
                            }), (0, a.jsx)("div", {
                                className: "mb-2 h-3.5 w-1/3 rounded-full bg-highlight"
                            }), (0, a.jsx)("div", {
                                className: "h-3.5 w-2/5 rounded-full bg-highlight"
                            }), (0, a.jsx)("div", {
                                className: "mt-5 flex gap-2 overflow-hidden",
                                children: Array.from({
                                    length: 6
                                }).map((e, l) => (0, a.jsx)("div", {
                                    className: "aspect-square min-w-10 flex-shrink-0 rounded-md bg-highlight"
                                }, l))
                            })]
                        })
                    }), (0, a.jsxs)("div", {
                        className: "relative z-10 flex flex-1 flex-col justify-between",
                        children: [(0, a.jsxs)("div", {
                            className: "flex items-start gap-2.5",
                            children: [(0, a.jsx)("div", {
                                className: "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-300/20 bg-blue-500/10 text-blue-200",
                                children: (0, a.jsx)(C.Z, {
                                    className: "h-4 w-4"
                                })
                            }), (0, a.jsxs)("div", {
                                className: "min-w-0",
                                children: [(0, a.jsx)("div", {
                                    className: "flex flex-wrap items-center gap-2",
                                    children: (0, a.jsx)("p", {
                                        className: "text-sm font-semibold text-white",
                                        children: l > 0 ? "Unlock ".concat(l.toLocaleString(), " more trending pick").concat(1 === l ? "" : "s") : "Unlock more trending picks"
                                    })
                                }), (0, a.jsx)("p", {
                                    className: "mt-1 text-xs leading-4 text-muted-foreground",
                                    children: "View the full board, compare books, and open player context before you build."
                                })]
                            })]
                        }), t && !r ? (0, a.jsx)(x.Xn, {
                            children: n
                        }) : n]
                    })]
                })
            }

            function z() {
                return (0, a.jsxs)("div", {
                    className: "relative min-h-[10.75rem] overflow-hidden rounded-xl border border-input bg-new-bg",
                    children: [(0, a.jsx)("div", {
                        className: "pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-gray-800 to-new-bg"
                    }), (0, a.jsxs)("div", {
                        className: "relative z-20 flex h-full flex-col opacity-70 blur-[1.5px]",
                        children: [(0, a.jsxs)("div", {
                            className: "flex items-start justify-between gap-3 px-3 pb-1 pt-2",
                            children: [(0, a.jsxs)("div", {
                                className: "flex min-w-0 flex-1 flex-col",
                                children: [(0, a.jsxs)("div", {
                                    className: "mb-2 flex min-w-0 items-center gap-3",
                                    children: [(0, a.jsx)("div", {
                                        className: "h-11 w-11 shrink-0 rounded-full bg-highlight"
                                    }), (0, a.jsxs)("div", {
                                        className: "flex min-w-0 flex-col gap-2",
                                        children: [(0, a.jsx)("div", {
                                            className: "h-3 w-32 rounded-full bg-highlight"
                                        }), (0, a.jsx)("div", {
                                            className: "h-3 w-24 rounded-full bg-highlight"
                                        })]
                                    })]
                                }), (0, a.jsxs)("div", {
                                    className: "flex items-center gap-2 pl-1",
                                    children: [(0, a.jsx)("div", {
                                        className: "h-3 w-36 rounded-full bg-highlight"
                                    }), (0, a.jsx)("div", {
                                        className: "h-3 w-16 rounded-full bg-highlight"
                                    })]
                                })]
                            }), (0, a.jsx)("div", {
                                className: "h-10 w-10 shrink-0 rounded-full border border-input bg-highlight/60"
                            })]
                        }), (0, a.jsx)("div", {
                            className: "mt-2 flex items-center gap-0.5 overflow-hidden",
                            children: Array.from({
                                length: 7
                            }).map((e, l) => (0, a.jsx)("div", {
                                className: "h-12 w-16 shrink-0 rounded-sm border-b border-input bg-highlight/70"
                            }, l))
                        }), (0, a.jsx)("div", {
                            className: "mt-auto flex items-center gap-2 overflow-hidden px-3 pb-2 pt-2",
                            children: Array.from({
                                length: 6
                            }).map((e, l) => (0, a.jsx)("div", {
                                className: "h-9 w-12 shrink-0 rounded-md bg-highlight"
                            }, l))
                        })]
                    }), (0, a.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030712]/10 via-[#030712]/58 to-[#030712]/30"
                    }), (0, a.jsx)("div", {
                        className: "pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/40 to-transparent"
                    }), (0, a.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 grid place-items-center",
                        children: (0, a.jsxs)("div", {
                            className: "relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-blue-200/20 bg-[#07111f]/85 text-blue-100 shadow-[0_18px_44px_-22px_rgba(52,97,255,0.95)] backdrop-blur-md",
                            children: [(0, a.jsx)("div", {
                                className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(96,165,250,0.30),transparent_62%)]"
                            }), (0, a.jsx)("div", {
                                className: "absolute inset-px rounded-2xl border border-white/[0.04]"
                            }), (0, a.jsx)("span", {
                                className: "relative grid h-8 w-8 place-items-center rounded-xl bg-blue-500/15 text-blue-100",
                                children: (0, a.jsx)(C.Z, {
                                    className: "h-4 w-4 drop-shadow-[0_0_12px_rgba(147,197,253,0.55)]"
                                })
                            })]
                        })
                    })]
                })
            }

            function O() {
                return (0, a.jsxs)("div", {
                    className: "rounded-xl bg-new-bg flex flex-col gap-2 border border-input p-4 h-44",
                    children: [(0, a.jsx)("div", {
                        className: "h-4 w-1/5 bg-highlight rounded-full"
                    }), (0, a.jsx)("div", {
                        className: "h-4 w-1/3 bg-highlight rounded-full"
                    }), (0, a.jsx)("div", {
                        className: "h-4 w-2/5 bg-highlight rounded-full"
                    }), (0, a.jsx)("div", {
                        className: "flex gap-2 w-full",
                        children: Array.from({
                            length: 6
                        }).map((e, l) => (0, a.jsx)("div", {
                            className: "min-w-12 flex-shrink-0 bg-highlight aspect-square rounded-md"
                        }, l))
                    })]
                })
            }

            function S() {
                return (0, a.jsx)("div", {
                    className: "grid grid-cols-1 md:grid-cols-2 gap-2 opacity-60",
                    children: Array.from({
                        length: 16
                    }).map((e, l) => (0, a.jsx)(O, {}, l))
                })
            }
        }
    },
    function(e) {
        e.O(0, [9732, 5308, 6717, 1069, 6582, 792, 748, 4885, 723, 6825, 9679, 9404, 5331, 4242, 8819, 9479, 4640, 2468, 9596, 6699, 679, 3209, 2261, 7926, 1872, 6741, 1478, 9819, 1163, 1469, 3757, 6381, 3471, 8161, 4860, 1592, 8933, 4358, 4174, 4375, 4676, 6292, 5552, 1355, 1744], function() {
            return e(e.s = 42478)
        }), _N_E = e.O()
    }
]);