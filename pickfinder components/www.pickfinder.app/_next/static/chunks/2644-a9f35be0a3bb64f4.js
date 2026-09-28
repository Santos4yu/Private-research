"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [2644], {
        2644: function(e, s, l) {
            l.d(s, {
                BO: function() {
                    return S
                },
                dg: function() {
                    return F
                },
                h7: function() {
                    return P
                }
            });
            var a = l(10131),
                t = l(55185),
                n = l(397),
                d = l(30138),
                i = l(6603),
                r = l(24302),
                o = l(9365),
                c = l(70083),
                x = l(76840),
                u = l(47343),
                m = l(11133),
                p = l(59564),
                v = l(81460),
                h = l(96523),
                g = l(75775),
                f = l(58685),
                b = l(93630),
                j = l(64276),
                N = l(63210);
            let y = {
                light: "",
                dark: ".dark"
            };

            function w(e, s) {
                if (!(null == s ? void 0 : s.trim())) return null;
                let l = s.trim(),
                    a = l.toLowerCase();
                return "mlb" === e ? a.includes("switch") || a.includes("both") || "s" === a || "b" === a ? "SHP" : a.includes("right") || "r" === a || "rhp" === a ? "RHP" : a.includes("left") || "l" === a || "lhp" === a ? "LHP" : /^(R|L|SH)P$/i.test(l) ? l.toUpperCase() : l : "right" === l ? "Righty" : "left" === l ? "Lefty" : l
            }
            let k = t.createContext(null);

            function M() {
                let e = t.useContext(k);
                if (!e) throw Error("useChart must be used within a <ChartContainer />");
                return e
            }
            let S = t.forwardRef((e, s) => {
                let {
                    id: l,
                    className: d,
                    children: i,
                    config: r,
                    ...o
                } = e, c = t.useId(), x = "chart-".concat(l || c.replace(/:/g, ""));
                return (0, a.jsx)(k.Provider, {
                    value: {
                        config: r
                    },
                    children: (0, a.jsxs)("div", {
                        "data-chart": x,
                        ref: s,
                        className: (0, f.cn)("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none", d),
                        ...o,
                        children: [(0, a.jsx)(_, {
                            id: x,
                            config: r
                        }), (0, a.jsx)(n.h, {
                            children: i
                        })]
                    })
                })
            });
            S.displayName = "Chart";
            let _ = e => {
                    let {
                        id: s,
                        config: l
                    } = e, t = Object.entries(l).filter(e => {
                        let [s, l] = e;
                        return l.theme || l.color
                    });
                    return t.length ? (0, a.jsx)("style", {
                        dangerouslySetInnerHTML: {
                            __html: Object.entries(y).map(e => {
                                let [l, a] = e;
                                return "\n".concat(a, " [data-chart=").concat(s, "] {\n").concat(t.map(e => {
                                    var s;
                                    let [a, t] = e, n = (null === (s = t.theme) || void 0 === s ? void 0 : s[l]) || t.color;
                                    return n ? "  --color-".concat(a, ": ").concat(n, ";") : null
                                }).join("\n"), "\n}\n")
                            }).join("\n")
                        }
                    }) : null
                },
                P = d.u,
                F = t.forwardRef((e, s) => {
                    let {
                        active: l,
                        payload: n,
                        supporting: d = !1,
                        className: i,
                        indicator: y = "dot",
                        hideLabel: k = !1,
                        hideIndicator: S = !1,
                        label: _,
                        labelFormatter: P,
                        labelClassName: F,
                        formatter: Z,
                        color: L,
                        nameKey: R,
                        labelKey: C,
                        sport: A,
                        statMapByDisplay: D
                    } = e, {
                        config: Q
                    } = M(), z = t.useMemo(() => {
                        var e;
                        if (k || !(null == n ? void 0 : n.length)) return null;
                        let [s] = n, l = "".concat(C || s.dataKey || s.name || "value"), t = H(Q, s, l), d = C || "string" != typeof _ ? null == t ? void 0 : t.label : (null === (e = Q[_]) || void 0 === e ? void 0 : e.label) || _;
                        return P ? (0, a.jsx)("div", {
                            className: (0, f.cn)("font-medium", F),
                            children: P(d, n)
                        }) : d ? (0, a.jsx)("div", {
                            className: (0, f.cn)("font-medium", F),
                            children: d
                        }) : null
                    }, [_, P, n, k, F, Q, C]);
                    if (!l || !(null == n ? void 0 : n.length)) return null;
                    let G = 1 === n.length && "dot" !== y;
                    return (0, a.jsxs)("div", {
                        ref: s,
                        className: (0, f.cn)("grid min-w-[8rem] z-50 items-start gap-1.5 rounded-lg border overflow-hidden border-input-border bg-gray-900 text-xs shadow-xl", i),
                        children: [G ? null : z, (0, a.jsx)("div", {
                            className: "grid gap-1.5",
                            children: n.map((e, s) => {
                                var l, n, i, k, M, _, P, F, C, D, B, T, K, I, O, U, E, W, $, q, J, V, X, Y, ee, es, el, ea, et, en, ed, ei, er, eo, ec, ex, eu, em, ep, ev, eh, eg, ef, eb, ej, eN, ey, ew, ek, eM, eS, e_, eP, eF, eH, eZ, eL, eR, eC, eA, eD, eQ, ez, eG, eB, eT, eK, eI, eO, eU, eE, eW, e$, eq, eJ, eV, eX, eY, e0;
                                if (0 !== s) return null;
                                let e1 = "".concat(R || e.name || e.dataKey || "value"),
                                    e5 = H(Q, e, e1),
                                    e2 = L || e.payload.fill || e.color;
                                if (e.payload.winProbability || e.payload.shortName || e.payload.name) return (0, a.jsx)("div", {
                                    className: (0, f.cn)("flex w-full p-1 flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground", "dot" === y && "items-center"),
                                    children: Z && (null == e ? void 0 : e.value) !== void 0 && e.name ? Z(e.value, e.name, e, s, e.payload) : (0, a.jsxs)(a.Fragment, {
                                        children: [(null == e5 ? void 0 : e5.icon) ? (0, a.jsx)(e5.icon, {}) : !S && (0, a.jsx)("div", {
                                            className: (0, f.cn)("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                                                "h-2.5 w-2.5": "dot" === y,
                                                "w-1": "line" === y,
                                                "w-0 border-[1.5px] border-dashed bg-transparent": "dashed" === y,
                                                "my-0.5": G && "dashed" === y
                                            }),
                                            style: {
                                                "--color-bg": e2,
                                                "--color-border": e2
                                            }
                                        }), (0, a.jsxs)("div", {
                                            className: (0, f.cn)("flex flex-1 justify-between leading-none", G ? "items-end" : "items-center"),
                                            children: [(0, a.jsxs)("div", {
                                                className: "grid gap-1.5 mr-1",
                                                children: [G ? z : null, (0, a.jsx)("span", {
                                                    className: "text-muted-foreground",
                                                    children: (null == e5 ? void 0 : e5.label) || e.name
                                                })]
                                            }), e.value && (0, a.jsx)("span", {
                                                className: "font-mono font-medium tabular-nums text-foreground",
                                                children: (null === (eV = e.payload) || void 0 === eV ? void 0 : eV.winProbability) ? "".concat(null === (eX = e.payload) || void 0 === eX ? void 0 : eX.winProbability, "%") : e.payload.shortName || e.payload.name ? e.payload.amount : e.value
                                            })]
                                        })]
                                    })
                                }, e.dataKey);
                                let e4 = "soccer" === A ? null === (l = e.payload) || void 0 === l ? void 0 : l.vs : null === (n = e.payload) || void 0 === n ? void 0 : n.vsAbbr,
                                    e3 = e => e && e.length > 20 ? "".concat(e.slice(0, 20).trimEnd(), "…") : e,
                                    e6 = null === (i = e.payload) || void 0 === i ? void 0 : i.date,
                                    e8 = null === (k = e.payload) || void 0 === k ? void 0 : k.maps,
                                    e7 = (null === (M = e.payload) || void 0 === M ? void 0 : M.scores) || (null == e8 ? void 0 : null === (_ = e8[0]) || void 0 === _ ? void 0 : _.scores),
                                    e9 = null === (F = e.payload.stats) || void 0 === F ? void 0 : null === (P = F[e.payload.stat]) || void 0 === P ? void 0 : P.potentials,
                                    se = null === (D = e.payload.stats) || void 0 === D ? void 0 : null === (C = D[e.payload.stat]) || void 0 === C ? void 0 : C.stacks,
                                    ss = null === (B = e.payload) || void 0 === B ? void 0 : B.stat,
                                    sl = null === (T = e.payload) || void 0 === T ? void 0 : T.daysRest,
                                    sa = null === (K = e.payload) || void 0 === K ? void 0 : K.spread,
                                    st = null === (I = e.payload) || void 0 === I ? void 0 : I.courtType,
                                    sn = w(A, null === (O = e.payload) || void 0 === O ? void 0 : O.vsHand),
                                    sd = null === (U = e.payload) || void 0 === U ? void 0 : U.stats,
                                    si = null === (E = e.payload) || void 0 === E ? void 0 : E.periodIndices,
                                    sr = ("nba" === A || "wnba" === A) && "string" == typeof ss ? ss.includes("1Q") ? "1Q Minutes" : ss.includes("4Q") ? "4Q Minutes" : ss.includes("1H") ? "1H Minutes" : ss.includes("2H") ? "2H Minutes" : "Minutes" : "Minutes",
                                    so = null !== (eY = null == sd ? void 0 : sd[sr]) && void 0 !== eY ? eY : null == sd ? void 0 : sd.Minutes,
                                    sc = "number" == typeof so ? so : "string" == typeof so ? Number(so) : so && "object" == typeof so && "value" in so ? Number(null == so ? void 0 : so.value) : void 0,
                                    sx = Number.isFinite(sc) ? sc : void 0,
                                    su = void 0 !== sx ? Math.round(sx) : void 0,
                                    sm = null !== (e0 = null == sd ? void 0 : sd["1Q Fouls"]) && void 0 !== e0 ? e0 : null == sd ? void 0 : sd["1Q Personal Fouls"],
                                    sp = "number" == typeof sm ? sm : "string" == typeof sm ? Number(sm) : sm && "object" == typeof sm && "value" in sm ? Number(null == sm ? void 0 : sm.value) : void 0,
                                    sv = Number.isFinite(sp) ? sp : void 0,
                                    sh = void 0 !== sv && sv >= 2;
                                return (0, a.jsxs)("div", {
                                    className: "flex flex-col min-w-52",
                                    children: [e6 && !(null === (W = e.payload) || void 0 === W ? void 0 : W.isDnpGroup) && (0, a.jsxs)("div", {
                                        className: "flex flex-col gap-1.5 bg-new-bg p-2",
                                        children: [(0, a.jsxs)("div", {
                                            className: "flex gap-1.5 items-center justify-between",
                                            children: [(0, a.jsxs)("div", {
                                                className: "flex flex-wrap gap-x-1.5 gap-y-1 items-center min-w-0",
                                                children: [(0, a.jsx)(r.Z, {
                                                    size: 12,
                                                    className: "stroke-muted-foreground shrink-0"
                                                }), " ", (0, a.jsx)("span", {
                                                    className: "text-muted-foreground shrink-0",
                                                    children: e6
                                                }), e4 && (0, a.jsxs)("span", {
                                                    className: "text-muted-foreground flex flex-wrap items-center gap-2 min-w-0",
                                                    children: [(null == e4 ? void 0 : e4.includes("@")) ? "" : "vs", " ", e3((null == e4 ? void 0 : e4.includes("@")) ? null == e4 ? void 0 : e4.replace("@", "@ ") : e4), (null === ($ = e.payload) || void 0 === $ ? void 0 : $.vsImage) ? (0, a.jsx)("span", {
                                                        className: "inline-flex items-center shrink-0",
                                                        children: (0, a.jsx)(g.default, {
                                                            src: e.payload.vsImage,
                                                            alt: e4,
                                                            width: 16,
                                                            height: 16,
                                                            className: "inline-block object-contain"
                                                        })
                                                    }) : A && b.U8.has(A) && "soccer" !== A ? (() => {
                                                        var s, l;
                                                        let t = null === (s = (null === (l = e.payload) || void 0 === l ? void 0 : l.vsAbbr) || e4) || void 0 === s ? void 0 : s.replace(/^@\s?/i, "").replace(/^vs\s?/i, "").trim();
                                                        return t ? (0, a.jsx)("span", {
                                                            className: "inline-flex items-center shrink-0",
                                                            children: (0, a.jsx)(j.Z, {
                                                                abbreviation: t,
                                                                sport: A,
                                                                size: 16
                                                            })
                                                        }) : null
                                                    })() : null]
                                                })]
                                            }), e4 && (0, a.jsx)(a.Fragment, {
                                                children: (null === (q = e.payload) || void 0 === q ? void 0 : q.winLoss) && (0, a.jsxs)("div", {
                                                    className: "flex gap-1.5 items-center shrink-0",
                                                    children: [(null === (J = e.payload) || void 0 === J ? void 0 : J.mapScore) && (0, a.jsx)("span", {
                                                        className: "text-xs ml-1",
                                                        children: (0, a.jsxs)("span", {
                                                            className: (0, f.cn)("W" === e.payload.winLoss ? "text-green-500" : "text-red-500"),
                                                            children: [e.payload.mapScore[0], "-", e.payload.mapScore[1]]
                                                        })
                                                    }), e7 && !(null === (V = e.payload) || void 0 === V ? void 0 : V.mapScore) && e7.map((s, l) => (0, a.jsxs)(t.Fragment, {
                                                        children: [(0, a.jsx)("div", {
                                                            className: (0, N.Z)("flex justify-between gap-2", l > 0 ? "flex-row-reverse" : "flex-row"),
                                                            children: (0, a.jsx)("p", {
                                                                className: (0, f.cn)("W" === e.payload.winLoss ? "text-green-500" : "text-red-500"),
                                                                children: s.score
                                                            }, "teamscore" + l)
                                                        }), 0 === l && (0, a.jsx)("p", {
                                                            className: "text-gray-400",
                                                            children: "-"
                                                        })]
                                                    }, "score" + l + l + e6)), (0, a.jsx)("span", {
                                                        className: (0, f.cn)("px-1.5 py-0.5 rounded text-xs font-medium border", "W" === e.payload.winLoss ? "bg-green-500/10 border-green-500/20 text-green-500" : "D" === e.payload.winLoss ? "bg-gray-500/10 border-gray-500/20 text-gray-500" : "bg-red-500/10 border-red-500/20 text-red-500"),
                                                        children: e.payload.winLoss
                                                    })]
                                                })
                                            })]
                                        }), "mlb" !== A && "tennis" !== A && sn && (0, a.jsxs)("div", {
                                            className: "flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground",
                                            children: [(0, a.jsx)("span", {
                                                className: "text-muted-foreground/65",
                                                children: "Opponent"
                                            }), (0, a.jsx)("span", {
                                                className: "text-muted-foreground/40",
                                                children: "\xb7"
                                            }), (0, a.jsx)("span", {
                                                className: "font-medium text-foreground/75",
                                                children: sn
                                            })]
                                        })]
                                    }), (null === (X = e.payload) || void 0 === X ? void 0 : X.isDnp) && (0, a.jsxs)("div", {
                                        className: "flex flex-col",
                                        children: [(null === (Y = e.payload) || void 0 === Y ? void 0 : Y.isDnpGroup) && (0, a.jsx)("div", {
                                            className: "flex gap-1.5 items-center justify-between bg-new-bg p-2",
                                            children: (0, a.jsxs)("div", {
                                                className: "flex gap-1.5 items-center",
                                                children: [(0, a.jsx)(r.Z, {
                                                    size: 12,
                                                    className: "stroke-muted-foreground"
                                                }), " ", (0, a.jsxs)("span", {
                                                    className: "text-muted-foreground whitespace-nowrap",
                                                    children: [e6, " - ", e3(e4)]
                                                })]
                                            })
                                        }), (0, a.jsxs)("div", {
                                            className: "px-4 py-3 bg-gradient-to-r from-slate-600 to-slate-700",
                                            children: [(0, a.jsxs)("div", {
                                                className: "flex items-center gap-3",
                                                children: [(0, a.jsx)("div", {
                                                    className: "p-2 bg-white/20 rounded-lg",
                                                    children: (0, a.jsx)(o.Z, {
                                                        className: "h-5 w-5 text-white"
                                                    })
                                                }), (0, a.jsxs)("div", {
                                                    children: [(0, a.jsx)("p", {
                                                        className: "text-xs text-slate-300",
                                                        children: (null === (ee = e.payload) || void 0 === ee ? void 0 : ee.isDnpGroup) ? "Extended Absence" : (null === (es = e.payload) || void 0 === es ? void 0 : es.dnpReason) || "Did Not Play"
                                                    }), (0, a.jsx)("p", {
                                                        className: "text-sm font-semibold text-white",
                                                        children: (null === (el = e.payload) || void 0 === el ? void 0 : el.isDnpGroup) ? "".concat(e.payload.dnpCount, " Missed Games") : "DNP"
                                                    })]
                                                })]
                                            }), (null === (ea = e.payload) || void 0 === ea ? void 0 : ea.isDnpGroup) && (0, a.jsxs)("div", {
                                                className: "mt-2 text-[10px] text-slate-300 bg-black/20 p-2 rounded border border-white/5 w-48",
                                                children: ["This player missed ", e.payload.dnpCount, " games in a row. They may be returning from an injury", "nba" === A ? " and could have a minutes restriction in their next game(s)." : "."]
                                            })]
                                        })]
                                    }), (0, a.jsxs)("div", {
                                        className: "flex flex-col",
                                        children: [!(null === (et = e.payload) || void 0 === et ? void 0 : et.isDnp) && (0, a.jsxs)("div", {
                                            className: "px-2 py-2 bg-gradient-to-r from-blue-700 to-blue-800",
                                            children: [(0, a.jsxs)("div", {
                                                className: "flex items-center justify-between gap-2",
                                                children: [(0, a.jsxs)("div", {
                                                    className: "flex items-center gap-3",
                                                    children: [(0, a.jsx)("div", {
                                                        className: "p-2 bg-white/20 rounded-lg",
                                                        children: (0, a.jsx)(c.Z, {
                                                            className: "h-5 w-5 text-white"
                                                        })
                                                    }), (0, a.jsxs)("div", {
                                                        children: [(0, a.jsx)("p", {
                                                            className: "text-xs text-blue-100",
                                                            children: null === (en = e.payload) || void 0 === en ? void 0 : en.stat
                                                        }), (0, a.jsx)("p", {
                                                            className: "text-lg font-bold text-white",
                                                            children: null === (ed = e.payload) || void 0 === ed ? void 0 : ed.amount
                                                        })]
                                                    })]
                                                }), (0, a.jsx)("div", {
                                                    className: "text-right",
                                                    children: (null === (ei = e.payload) || void 0 === ei ? void 0 : ei.backgroundStatTotal) !== void 0 && (0, a.jsxs)(a.Fragment, {
                                                        children: [(0, a.jsx)("p", {
                                                            className: "text-xs text-blue-200",
                                                            children: (null === (er = e.payload) || void 0 === er ? void 0 : er.forcedName) ? null === (eo = e.payload) || void 0 === eo ? void 0 : eo.forcedName : (null === (ep = e.payload) || void 0 === ep ? void 0 : null === (em = ep.stats) || void 0 === em ? void 0 : null === (ex = em[null === (eu = e.payload) || void 0 === eu ? void 0 : eu.stat]) || void 0 === ex ? void 0 : null === (ec = ex.background) || void 0 === ec ? void 0 : ec.stat) ? null === (eb = e.payload) || void 0 === eb ? void 0 : null === (ef = eb.stats) || void 0 === ef ? void 0 : null === (eh = ef[null === (eg = e.payload) || void 0 === eg ? void 0 : eg.stat]) || void 0 === eh ? void 0 : null === (ev = eh.background) || void 0 === ev ? void 0 : ev.stat : (null === (ej = e.payload) || void 0 === ej ? void 0 : ej.stat) && (null === (eN = e.payload) || void 0 === eN ? void 0 : eN.stat.includes("Rebounds")) ? "nba" === A ? "Chances".concat((null === (ew = e.payload) || void 0 === ew ? void 0 : null === (ey = ew.stat) || void 0 === ey ? void 0 : ey.includes("Q")) || (null === (eM = e.payload) || void 0 === eM ? void 0 : null === (ek = eM.stat) || void 0 === ek ? void 0 : ek.includes("H")) ? " (Full Game)" : "") : "Rebounds" : (null === (eS = e.payload) || void 0 === eS ? void 0 : eS.stat.includes("Break Points")) || (null === (e_ = e.payload) || void 0 === e_ ? void 0 : e_.stat.includes("BP")) ? (null === (eP = e.payload) || void 0 === eP ? void 0 : eP.stat.includes("BP Given Up")) || (null === (eF = e.payload) || void 0 === eF ? void 0 : eF.stat.includes("Saved")) ? "BP Served" : "BP Returned" : (null === (eH = e.payload) || void 0 === eH ? void 0 : eH.stat.includes("Assists")) ? "Potentials".concat((null === (eL = e.payload) || void 0 === eL ? void 0 : null === (eZ = eL.stat) || void 0 === eZ ? void 0 : eZ.includes("Q")) || (null === (eC = e.payload) || void 0 === eC ? void 0 : null === (eR = eC.stat) || void 0 === eR ? void 0 : eR.includes("H")) ? " (Full Game)" : "") : "Attempts"
                                                        }), (0, a.jsx)("p", {
                                                            className: "text-lg font-semibold text-white",
                                                            children: e.payload.backgroundStat < 0 ? "N/A" : null === (eA = e.payload) || void 0 === eA ? void 0 : eA.backgroundStatTotal
                                                        })]
                                                    })
                                                })]
                                            }), ("nba" === A || "wnba" === A || "cbb" === A || "wcbb" === A) && (void 0 !== sx || (null == sd ? void 0 : sd.Minutes) !== void 0 || (null == sd ? void 0 : sd[sr]) !== void 0 || void 0 !== sv) && (0, a.jsxs)("div", {
                                                className: "mt-2 flex gap-2",
                                                children: [(0, a.jsx)("div", {
                                                    className: "flex-1",
                                                    children: (0, a.jsxs)("div", {
                                                        className: "flex h-6 items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 text-blue-100",
                                                        children: [(0, a.jsx)("span", {
                                                            className: "text-[10px] leading-none",
                                                            children: "1Q Minutes" === sr ? "Minutes (1Q)" : "4Q Minutes" === sr ? "Minutes (4Q)" : "1H Minutes" === sr ? "Minutes (1H)" : "2H Minutes" === sr ? "Minutes (2H)" : "Minutes"
                                                        }), (0, a.jsx)("span", {
                                                            className: "font-mono font-semibold tabular-nums text-[10px] leading-none",
                                                            children: null != su ? su : "—"
                                                        })]
                                                    })
                                                }), (0, a.jsx)("div", {
                                                    className: "flex-1",
                                                    children: (0, a.jsxs)("div", {
                                                        className: (0, f.cn)("flex h-6 items-center justify-between rounded-md border px-2", sh ? "border-red-500/80 bg-red-500/35 text-red-50" : "border-white/10 bg-white/5 text-blue-100"),
                                                        children: [(0, a.jsxs)("span", {
                                                            className: "flex items-center gap-1.5 text-[10px] leading-none",
                                                            children: [sh && (0, a.jsx)(x.Z, {
                                                                className: "h-3.5 w-3.5 text-red-300"
                                                            }), (0, a.jsx)("span", {
                                                                children: "Fouls (1Q)"
                                                            })]
                                                        }), (0, a.jsx)("span", {
                                                            className: "font-mono font-semibold tabular-nums text-[10px] leading-none",
                                                            children: null != sv ? sv : "—"
                                                        })]
                                                    })
                                                })]
                                            })]
                                        }), "mlb" === A && !(null === (eD = e.payload) || void 0 === eD ? void 0 : eD.isDnp) && e7 && e7.length > 0 && e7.some(e => e.pitcher) && (0, a.jsxs)("div", {
                                            className: "border-t border-white/[0.06] bg-slate-950/95 px-2 py-2",
                                            children: [(0, a.jsx)("div", {
                                                className: "mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70",
                                                children: "Starting pitchers"
                                            }), (0, a.jsx)("div", {
                                                className: "flex flex-col gap-1",
                                                children: e7.map((e, s) => {
                                                    var l;
                                                    let t = w(A, e.pitcherHand);
                                                    return (0, a.jsxs)("div", {
                                                        className: "flex items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1.5",
                                                        children: [(0, a.jsx)("span", {
                                                            className: "min-w-0 truncate text-[11px] font-semibold text-foreground/90",
                                                            children: e.team
                                                        }), (0, a.jsxs)("span", {
                                                            className: "flex min-w-0 max-w-[64%] shrink items-center justify-end gap-1.5",
                                                            children: [(0, a.jsx)("span", {
                                                                className: "min-w-0 truncate text-right text-[11px] text-muted-foreground",
                                                                children: (null === (l = e.pitcher) || void 0 === l ? void 0 : l.trim()) ? e.pitcher : "—"
                                                            }), t && (0, a.jsx)("span", {
                                                                className: "shrink-0 rounded border border-white/[0.08] bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/80",
                                                                children: t
                                                            })]
                                                        })]
                                                    }, "mlb-sp-".concat(s, "-").concat(e.team))
                                                })
                                            })]
                                        }), se && se.length > 0 && (!e8 || e8.length <= 1) && (0, a.jsx)("div", {
                                            className: "p-2 bg-slate-800",
                                            children: (0, a.jsx)("div", {
                                                className: "flex items-center justify-between gap-2",
                                                children: se.map((e, s) => (0, a.jsxs)("div", {
                                                    className: "flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-slate-700/50 w-full",
                                                    children: [(0, a.jsxs)("div", {
                                                        className: "flex items-center gap-2",
                                                        children: [(0, a.jsx)("div", {
                                                            className: "w-2 h-2 rounded-full ".concat(0 === s ? "bg-blue-400" : "bg-purple-400")
                                                        }), (0, a.jsx)("span", {
                                                            className: "text-xs text-slate-300 text-nowrap",
                                                            children: e.stat
                                                        })]
                                                    }), (0, a.jsx)("span", {
                                                        className: "font-semibold ".concat(0 === s ? "text-blue-400" : "text-purple-400"),
                                                        children: e.value
                                                    })]
                                                }, "stack".concat(s)))
                                            })
                                        }), e9 && e9.length > 0 && A && (!e8 || e8.length <= 1) && (0, a.jsx)("div", {
                                            className: "p-2 bg-slate-900",
                                            children: (0, a.jsx)("div", {
                                                className: "grid grid-cols-1 gap-2",
                                                children: e9.map((s, l) => {
                                                    var t, n;
                                                    return (0, a.jsxs)("div", {
                                                        className: "flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50",
                                                        children: [(0, a.jsx)("div", {
                                                            className: "flex items-center gap-2",
                                                            children: (0, a.jsx)("div", {
                                                                className: "flex flex-col",
                                                                children: (0, a.jsxs)("span", {
                                                                    className: "text-xs text-slate-300",
                                                                    children: [s.stat, (null === (t = e.payload) || void 0 === t ? void 0 : t.stat.includes("Q")) || (null === (n = e.payload) || void 0 === n ? void 0 : n.stat.includes("H")) ? " (Full Game)" : ""]
                                                                })
                                                            })
                                                        }), (0, a.jsx)("span", {
                                                            className: "font-semibold text-yellow-400",
                                                            children: s.value < 0 ? "N/A" : s.value
                                                        })]
                                                    }, "potential".concat(l))
                                                })
                                            })
                                        }), e8 && e8.length > 0 && A && (null === (eQ = b.ZP[A]) || void 0 === eQ ? void 0 : eQ.esport) ? (0, a.jsx)("div", {
                                            className: "flex flex-col gap-1 p-1",
                                            children: e8.map((e, s) => {
                                                var l, n, d;
                                                let i = Math.max(...e.scores.map(e => e.score));
                                                return (0, a.jsxs)("div", {
                                                    className: (0, N.Z)("flex flex-col gap-2 p-2", (null == si ? void 0 : si.includes(s)) && "rounded-lg border border-blue-500 bg-blue-300/5"),
                                                    children: [(0, a.jsxs)("div", {
                                                        className: "grid grid-cols-[1fr,auto,1fr] items-center gap-4 text-muted-foreground",
                                                        children: [!sa && !(null == e7 ? void 0 : null === (l = e7[0]) || void 0 === l ? void 0 : l.setScores) && (0, a.jsxs)("span", {
                                                            className: "text-muted-foreground/60",
                                                            children: ["Map ", s + 1, " -", " ", (0, a.jsx)("span", {
                                                                className: "W" === e.winLoss ? "text-green-500 text-bold" : "text-red-500",
                                                                children: e.winLoss
                                                            })]
                                                        }), (0, a.jsx)("div", {
                                                            className: "flex gap-2 items-center",
                                                            children: e.map && (0, a.jsxs)("p", {
                                                                className: "text-gray-400",
                                                                children: [e.map, e.gameMode && (0, a.jsxs)("span", {
                                                                    className: "text-xs text-blue-500",
                                                                    children: [" - ", e.gameMode]
                                                                })]
                                                            })
                                                        }), (0, a.jsxs)("div", {
                                                            className: "text-muted-foreground text-right",
                                                            children: [(0, a.jsx)("span", {
                                                                children: null === (n = sd["Map ".concat(s + 1, " ").concat(ss.includes("Kills") ? "Kills" : ss.includes("HS") ? "HS" : ss.includes("Fantasy") ? "Fantasy Score (UD)" : ss.includes("First Blood") ? "First Bloods" : ss.includes("Assists") && ss.includes("Map") ? "Assists" : ss)]) || void 0 === n ? void 0 : n.value
                                                            }), " ", ss.includes("Kills") ? "Kills" : ss.includes("HS") ? "Headshots" : ss.includes("Fantasy") ? "Fantasy Points" : ss.includes("First Blood") ? "First Bloods" : ss.includes("Assists") && ss.includes("Map") ? "Assists" : ss]
                                                        })]
                                                    }), (0, a.jsx)("div", {
                                                        className: "grid grid-cols-[1fr,auto,1fr] items-center gap-2",
                                                        children: e.scores.map((l, n) => (0, a.jsxs)(t.Fragment, {
                                                            children: [(0, a.jsxs)("div", {
                                                                className: (0, N.Z)("flex justify-between gap-2", n > 0 ? "flex-row-reverse" : "flex-row"),
                                                                children: [(0, a.jsx)("p", {
                                                                    className: "text-primary",
                                                                    children: l.team
                                                                }, "team" + n), (0, a.jsx)("p", {
                                                                    className: (0, N.Z)(!e.hero && l.score == i || e.hero && l.winner ? "text-green-500 text-bold" : "text-red-500"),
                                                                    children: l.score
                                                                }, "teamscore" + n)]
                                                            }), 0 === n && (0, a.jsx)("p", {
                                                                className: "text-gray-400",
                                                                children: "-"
                                                            })]
                                                        }, "score" + n + s + e6))
                                                    }), e.hero && (0, a.jsx)("div", {
                                                        className: "flex items-center bg-gray-800/30 px-2 py-2 rounded",
                                                        children: (0, a.jsxs)("div", {
                                                            className: "flex items-center gap-2 overflow-hidden",
                                                            children: [(0, a.jsx)("div", {
                                                                className: "relative w-[40px] h-[22px]",
                                                                children: (0, a.jsx)(g.default, {
                                                                    src: "val" === A ? "/images/valagents/".concat("val" === A ? null === (d = e.hero.name) || void 0 === d ? void 0 : d.toLowerCase() : e.hero.name, ".png") : e.hero.image,
                                                                    alt: e.hero.name,
                                                                    fill: !0,
                                                                    sizes: "40px",
                                                                    className: "object-cover rounded",
                                                                    priority: !0
                                                                })
                                                            }), (0, a.jsx)("span", {
                                                                className: "text-sm text-orange-400 font-medium",
                                                                children: e.hero.name
                                                            })]
                                                        })
                                                    })]
                                                }, e6 + "map" + s)
                                            })
                                        }) : !e7 || null === (ez = e7[0]) || void 0 === ez || !ez.players || (null === (eG = e.payload) || void 0 === eG ? void 0 : eG.potentials) || (null === (eB = e.payload) || void 0 === eB ? void 0 : eB.isDnpGroup) || (null === (eT = e.payload) || void 0 === eT ? void 0 : eT.dnp) ? (0, a.jsx)(a.Fragment, {}) : (0, a.jsx)("div", {
                                            className: "p-1.5 bg-slate-900",
                                            children: e7.map((e, s) => {
                                                var l, t;
                                                return e.dnp && !d ? (0, a.jsxs)("div", {
                                                    className: (0, N.Z)("space-y-2", 0 === s && "mb-2"),
                                                    children: [(0, a.jsx)("div", {
                                                        className: "flex items-center justify-between",
                                                        children: (0, a.jsxs)("div", {
                                                            className: "flex items-center gap-1.5",
                                                            children: [(0, a.jsx)("div", {
                                                                className: "p-1 bg-slate-700/50 rounded",
                                                                children: 0 === s ? (0, a.jsx)(u.Z, {
                                                                    size: 10,
                                                                    className: "text-blue-400"
                                                                }) : (0, a.jsx)(m.Z, {
                                                                    size: 10,
                                                                    className: "text-purple-400"
                                                                })
                                                            }), (0, a.jsxs)("span", {
                                                                className: "text-xs font-medium text-white",
                                                                children: [e.team, " Missing Players"]
                                                            })]
                                                        })
                                                    }), (() => {
                                                        let s = e.dnp || [];
                                                        return 0 === s.length ? (0, a.jsx)("div", {
                                                            className: "pb-2 w-48 text-left grid place-items-center px-2 mx-auto",
                                                            children: (0, a.jsx)("span", {
                                                                className: "text-slate-400 text-[10px] text-center",
                                                                children: "No significant missing players"
                                                            })
                                                        }) : (0, a.jsx)("div", {
                                                            className: "flex flex-col gap-1.5",
                                                            children: s.map(e => (0, a.jsxs)("div", {
                                                                className: "bg-slate-800/40 rounded border border-slate-700/30 p-2 flex items-center gap-3",
                                                                children: [(0, a.jsx)("div", {
                                                                    className: "p-1.5 bg-red-500/10 rounded-lg border border-red-500/20 shrink-0",
                                                                    children: (0, a.jsx)(o.Z, {
                                                                        size: 14,
                                                                        className: "text-red-500"
                                                                    })
                                                                }), (0, a.jsxs)("div", {
                                                                    className: "flex-1 min-w-0",
                                                                    children: [(0, a.jsx)("div", {
                                                                        className: "flex items-center gap-2",
                                                                        children: (0, a.jsx)("span", {
                                                                            className: "text-[11px] text-white font-medium truncate",
                                                                            children: e.name
                                                                        })
                                                                    }), (0, a.jsx)("div", {
                                                                        className: "text-[9px] text-slate-500 flex items-center gap-1.5",
                                                                        children: (0, a.jsx)("span", {
                                                                            children: e.not_playing_reason
                                                                        })
                                                                    })]
                                                                })]
                                                            }, e.name))
                                                        })
                                                    })()]
                                                }, e.team) : e.players && (0, a.jsxs)("div", {
                                                    className: (0, N.Z)("space-y-1.5", 0 === s && "mb-2"),
                                                    children: [(0, a.jsxs)("div", {
                                                        className: "flex items-center justify-between",
                                                        children: [(0, a.jsxs)("div", {
                                                            className: "flex items-center gap-1.5",
                                                            children: [(0, a.jsx)("div", {
                                                                className: "p-1 bg-slate-700/50 rounded",
                                                                children: 0 === s ? (0, a.jsx)(u.Z, {
                                                                    size: 10,
                                                                    className: "text-blue-400"
                                                                }) : (0, a.jsx)(m.Z, {
                                                                    size: 10,
                                                                    className: "text-purple-400"
                                                                })
                                                            }), (0, a.jsx)("span", {
                                                                className: "text-xs font-medium text-white",
                                                                children: e.team
                                                            })]
                                                        }), (0, a.jsx)("div", {
                                                            className: "text-[10px] text-slate-400 bg-slate-700/30 px-1.5 py-0.5 rounded",
                                                            children: "Player Stats"
                                                        })]
                                                    }), (null === (l = e.players) || void 0 === l ? void 0 : l.length) === 0 ? (0, a.jsx)("div", {
                                                        className: "text-center py-1",
                                                        children: (0, a.jsx)("span", {
                                                            className: "text-slate-400 text-[10px]",
                                                            children: "No players"
                                                        })
                                                    }) : (0, a.jsx)("table", {
                                                        className: "text-xs w-full",
                                                        children: (0, a.jsx)("tbody", {
                                                            children: null == e ? void 0 : null === (t = e.players) || void 0 === t ? void 0 : t.map(e => (0, a.jsxs)("tr", {
                                                                children: [(0, a.jsx)("td", {
                                                                    className: "pr-2 text-slate-300",
                                                                    children: e.name
                                                                }), (0, a.jsxs)("td", {
                                                                    className: "pr-2 text-muted-foreground",
                                                                    children: [e.minutes, " min"]
                                                                }), (0, a.jsxs)("td", {
                                                                    className: "text-muted-foreground",
                                                                    children: [e.points, "PTS/", e.rebounds, "R/", e.assists, "A"]
                                                                })]
                                                            }, e.name))
                                                        })
                                                    })]
                                                }, e.team)
                                            })
                                        }), e7 && (null === (eK = e7[0]) || void 0 === eK ? void 0 : eK.setScores) && (0, a.jsxs)("div", {
                                            className: "bg-slate-900 p-2",
                                            children: [(0, a.jsxs)("div", {
                                                className: "grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 border-b border-slate-800 pb-1.5",
                                                children: [(0, a.jsx)("span", {
                                                    className: "text-[10px] font-medium uppercase tracking-wide text-slate-500",
                                                    children: "Scores"
                                                }), (0, a.jsx)("span", {
                                                    className: "w-10 text-right text-[10px] font-medium uppercase tracking-wide text-slate-500",
                                                    children: "ML"
                                                }), (0, a.jsx)("span", {
                                                    className: "w-4",
                                                    "aria-hidden": !0
                                                }), (0, a.jsx)("span", {
                                                    className: "w-10 text-right text-[10px] font-medium uppercase tracking-wide text-slate-500",
                                                    children: "IP"
                                                })]
                                            }), e7.map((e, s) => {
                                                var l, t, n, d, i;
                                                let r = (null !== (d = e.score) && void 0 !== d ? d : 0) > (null !== (i = null == e7 ? void 0 : null === (l = e7[1 - s]) || void 0 === l ? void 0 : l.score) && void 0 !== i ? i : 0),
                                                    o = null === (t = e.odds) || void 0 === t ? void 0 : t.american,
                                                    c = void 0 === o ? null : o > 0 ? "+".concat(o) : "".concat(o),
                                                    x = (null === (n = e.odds) || void 0 === n ? void 0 : n.ip) !== void 0 ? "".concat(Math.round(100 * e.odds.ip), "%") : null;
                                                return (0, a.jsxs)("div", {
                                                    className: (0, f.cn)("grid grid-cols-[1fr_auto_auto_auto] items-start gap-x-2 py-2", s > 0 && "border-t border-slate-800"),
                                                    children: [(0, a.jsxs)("div", {
                                                        className: "min-w-0",
                                                        children: [(0, a.jsxs)("div", {
                                                            className: "flex items-center gap-1.5",
                                                            children: [(0, a.jsx)("span", {
                                                                className: "truncate text-xs font-medium text-slate-300",
                                                                children: e.team
                                                            }), Number(e.rank) > 0 && (0, a.jsxs)("span", {
                                                                className: "shrink-0 text-[10px] text-slate-500",
                                                                children: ["#", Number(e.rank)]
                                                            })]
                                                        }), "tennis" === A && 1 === s && sn ? (0, a.jsx)("div", {
                                                            className: "mt-0.5 text-[10px] text-slate-500",
                                                            children: sn
                                                        }) : null, (0, a.jsx)("div", {
                                                            className: "mt-1.5 flex items-center gap-1",
                                                            children: [0, 1, 2, 3, 4].map(l => {
                                                                var t, n, d, i, r, o;
                                                                if ((null === (t = e.setScores) || void 0 === t ? void 0 : t[l]) === void 0) return null;
                                                                let c = (null == e7 ? void 0 : null === (d = e7[1 - s]) || void 0 === d ? void 0 : null === (n = d.setScores) || void 0 === n ? void 0 : n[l]) !== void 0 && (null !== (o = e.setScores[l]) && void 0 !== o ? o : 0) > ((null == e7 ? void 0 : null === (r = e7[1 - s]) || void 0 === r ? void 0 : null === (i = r.setScores) || void 0 === i ? void 0 : i[l]) || 0);
                                                                return (0, a.jsx)("span", {
                                                                    className: (0, f.cn)("inline-flex h-6 min-w-[22px] items-center justify-center rounded-md border text-xs font-medium tabular-nums", c ? "border-green-500/30 bg-green-500/15 text-green-400" : "border-red-500/30 bg-red-500/15 text-red-400"),
                                                                    children: e.setScores[l]
                                                                }, l)
                                                            })
                                                        })]
                                                    }), (0, a.jsx)("span", {
                                                        className: (0, f.cn)("w-10 pt-0.5 text-right text-xs tabular-nums", c ? "text-slate-400" : "text-slate-600"),
                                                        children: null != c ? c : "N/A"
                                                    }), (0, a.jsx)("span", {
                                                        className: "-ml-1.5 flex w-4 justify-center pt-0.5",
                                                        children: r && c ? (0, a.jsx)(p.Z, {
                                                            className: "h-3.5 w-3.5 text-green-500"
                                                        }) : null
                                                    }), (0, a.jsx)("span", {
                                                        className: (0, f.cn)("w-10 pt-0.5 text-right text-xs font-medium tabular-nums", x ? "text-slate-200" : "text-slate-600"),
                                                        children: null != x ? x : "N/A"
                                                    })]
                                                }, e.team + s)
                                            })]
                                        })]
                                    }), "cs2" === A && ((null === (eI = e.payload) || void 0 === eI ? void 0 : eI.teamRanking) || (null === (eO = e.payload) || void 0 === eO ? void 0 : eO.opponentRanking)) ? (0, a.jsxs)("div", {
                                        className: "bg-slate-800/50 px-2 py-1 border-t border-slate-700/50",
                                        children: [(0, a.jsxs)("div", {
                                            className: "flex items-center justify-between gap-4",
                                            children: [(0, a.jsxs)("div", {
                                                className: "flex items-center gap-2",
                                                children: [(0, a.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-blue-400"
                                                }), (0, a.jsx)("span", {
                                                    className: "text-xs text-slate-300",
                                                    children: "Team Rank"
                                                })]
                                            }), (0, a.jsx)("span", {
                                                className: "text-sm font-semibold text-blue-400",
                                                children: (null === (eU = e.payload) || void 0 === eU ? void 0 : eU.teamRanking) ? "#".concat(e.payload.teamRanking) : "Unranked"
                                            })]
                                        }), (0, a.jsxs)("div", {
                                            className: "flex items-center justify-between gap-4 mt-1.5",
                                            children: [(0, a.jsxs)("div", {
                                                className: "flex items-center gap-2",
                                                children: [(0, a.jsx)("div", {
                                                    className: "w-2 h-2 rounded-full bg-red-400"
                                                }), (0, a.jsx)("span", {
                                                    className: "text-xs text-slate-300",
                                                    children: "Opponent Rank"
                                                })]
                                            }), (0, a.jsx)("span", {
                                                className: "text-sm font-semibold text-red-400",
                                                children: (null === (eE = e.payload) || void 0 === eE ? void 0 : eE.opponentRanking) ? "#".concat(e.payload.opponentRanking) : "Unranked"
                                            })]
                                        })]
                                    }) : null, void 0 !== sa && (0, a.jsxs)("div", {
                                        className: "bg-new-bg flex items-center p-2 justify-between",
                                        children: [void 0 !== sl && -1 !== sl && (0, a.jsx)("div", {
                                            className: "text-xs text-muted-foreground",
                                            children: (null === (eW = e.payload) || void 0 === eW ? void 0 : eW.isDnp) ? "" : "".concat(sl, " days rest")
                                        }), (0, a.jsxs)("div", {
                                            className: "text-xs text-muted-foreground",
                                            children: [sa, " Spread"]
                                        })]
                                    }), e4 && (null === (e$ = e.payload) || void 0 === e$ ? void 0 : e$.event) && void 0 === sa && (0, a.jsxs)("div", {
                                        className: "bg-new-bg flex items-center p-2 justify-between",
                                        children: [(0, a.jsxs)("div", {
                                            className: "flex flex-col gap-1",
                                            children: [(null === (eq = e.payload) || void 0 === eq ? void 0 : eq.event) && (0, a.jsx)("div", {
                                                className: "text-xs text-muted-foreground whitespace-normal break-words max-w-[250px]",
                                                children: e.payload.event.replace(" Men Singles", "").replace(" Women Singles", "")
                                            }), (null === (eJ = e.payload) || void 0 === eJ ? void 0 : eJ.round) && (0, a.jsxs)("div", {
                                                className: "text-xs text-muted-foreground/60",
                                                children: [st ? "".concat((0, f.mL)(st), " - ") : "", (0, f.mL)(e.payload.round)]
                                            })]
                                        }), e.payload.type && (0, a.jsx)("div", {
                                            className: "flex items-center gap-1.5",
                                            children: "tennis" === A ? (0, a.jsx)("div", {
                                                className: "flex items-center gap-1.5 px-2 ml-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500",
                                                children: (0, a.jsx)("span", {
                                                    className: "text-[10px] font-medium",
                                                    children: e.payload.type
                                                })
                                            }) : "offline" === e.payload.type.toLowerCase() ? (0, a.jsxs)("div", {
                                                className: "flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500",
                                                children: [(0, a.jsx)(v.Z, {
                                                    size: 12
                                                }), (0, a.jsx)("span", {
                                                    className: "text-[10px] font-medium",
                                                    children: "LAN"
                                                })]
                                            }) : (0, a.jsxs)("div", {
                                                className: "flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500",
                                                children: [(0, a.jsx)(h.Z, {
                                                    size: 12
                                                }), (0, a.jsx)("span", {
                                                    className: "text-[10px] font-medium",
                                                    children: "Online"
                                                })]
                                            })
                                        })]
                                    })]
                                }, e6 + s)
                            })
                        })]
                    })
                });

            function H(e, s, l) {
                if ("object" != typeof s || null === s) return;
                let a = "payload" in s && "object" == typeof s.payload && null !== s.payload ? s.payload : void 0,
                    t = l;
                return l in s && "string" == typeof s[l] ? t = s[l] : a && l in a && "string" == typeof a[l] && (t = a[l]), t in e ? e[t] : e[l]
            }
            F.displayName = "ChartTooltip", i.D, t.forwardRef((e, s) => {
                let {
                    className: l,
                    hideIcon: t = !1,
                    payload: n,
                    verticalAlign: d = "bottom",
                    nameKey: i
                } = e, {
                    config: r
                } = M();
                return (null == n ? void 0 : n.length) ? (0, a.jsx)("div", {
                    ref: s,
                    className: (0, f.cn)("flex items-center justify-center gap-4", "top" === d ? "pb-3" : "pt-3", l),
                    children: n.map(e => {
                        let s = "".concat(i || e.dataKey || "value"),
                            l = H(r, e, s);
                        return (0, a.jsxs)("div", {
                            className: (0, f.cn)("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"),
                            children: [(null == l ? void 0 : l.icon) && !t ? (0, a.jsx)(l.icon, {}) : (0, a.jsx)("div", {
                                className: "h-2 w-2 shrink-0 rounded-[2px]",
                                style: {
                                    backgroundColor: e.color
                                }
                            }), null == l ? void 0 : l.label]
                        }, e.value)
                    })
                }) : null
            }).displayName = "ChartLegend"
        }
    }
]);