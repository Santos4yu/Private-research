"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4375], {
        3820: function(e, t, a) {
            a.d(t, {
                w: function() {
                    return y
                }
            });
            var s = a(10131),
                r = a(55185),
                n = a(7593),
                l = a(81460),
                i = a(52058),
                o = a(45640),
                d = a(41732),
                c = a(40122),
                x = a(47288),
                u = a(69687),
                h = a(55212),
                p = a(97848),
                m = a(58685);
            let g = e => "$".concat(e.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }));

            function b(e) {
                let {
                    children: t
                } = e;
                return (0, s.jsxs)("div", {
                    className: "relative overflow-hidden rounded-2xl border border-[#6f8dff]/40 bg-gradient-to-t from-blue-800 to-blue-600 text-white shadow-[0_18px_40px_-20px_rgba(52,97,255,0.9)]",
                    children: [(0, s.jsx)("div", {
                        className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.22),transparent_45%)]"
                    }), (0, s.jsx)("div", {
                        className: "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    }), (0, s.jsx)("div", {
                        className: "relative z-10 flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3",
                        children: t
                    })]
                })
            }

            function f(e) {
                let {
                    playerId: t,
                    imageUrl: a,
                    name: r,
                    sport: n,
                    market: l,
                    matchup: i,
                    right: o
                } = e;
                return (0, s.jsxs)("div", {
                    className: "flex items-start justify-between gap-2",
                    children: [(0, s.jsxs)("div", {
                        className: "flex min-w-0 items-center gap-2.5",
                        children: [(0, s.jsx)(h.A, {
                            playerId: t,
                            imageUrl: a,
                            playerName: r,
                            sport: n,
                            size: 40,
                            className: "border-2 border-white/30 shadow-md"
                        }), (0, s.jsxs)("div", {
                            className: "flex min-w-0 flex-col",
                            children: [(0, s.jsxs)("div", {
                                className: "flex min-w-0 items-center gap-1.5",
                                children: [(0, s.jsx)("span", {
                                    className: "truncate text-xs font-semibold",
                                    children: r
                                }), (0, s.jsx)(p.C, {
                                    sport: n,
                                    size: 13
                                })]
                            }), (0, s.jsx)("span", {
                                className: "truncate text-[11px] text-blue-100/80",
                                children: l
                            }), (0, s.jsx)("span", {
                                className: "truncate text-[11px] text-blue-100/60",
                                children: i
                            })]
                        })]
                    }), (0, s.jsx)("div", {
                        className: "flex shrink-0 flex-col items-end leading-tight",
                        children: o
                    })]
                })
            }
            let w = "rounded-xl border border-white/15 bg-white/10";

            function v(e) {
                let {
                    label: t,
                    book: a,
                    price: r,
                    rows: n
                } = e;
                return (0, s.jsxs)("div", {
                    className: (0, m.cn)(w, "flex flex-col gap-1.5 p-2"),
                    children: [(0, s.jsx)("span", {
                        className: "truncate text-[11px] font-medium text-blue-50",
                        children: t
                    }), (0, s.jsxs)("div", {
                        className: "flex items-center justify-between gap-1",
                        children: [(0, s.jsx)("span", {
                            className: "rounded-md bg-white/90 p-[2px]",
                            children: (0, s.jsx)(x.Z, {
                                appName: a,
                                size: 20
                            })
                        }), (0, s.jsx)("span", {
                            className: "text-sm font-bold tabular-nums text-white",
                            children: r
                        })]
                    }), (0, s.jsx)("div", {
                        className: "flex flex-col gap-0.5 border-t border-white/15 pt-1",
                        children: n.map(e => {
                            let [t, a, r] = e;
                            return (0, s.jsxs)("div", {
                                className: "flex items-baseline justify-between gap-1",
                                children: [(0, s.jsx)("span", {
                                    className: "text-[10px] text-blue-100/70",
                                    children: t
                                }), (0, s.jsx)("span", {
                                    className: (0, m.cn)("text-xs font-bold tabular-nums", r ? "text-emerald-200" : "text-white"),
                                    children: a
                                })]
                            }, t)
                        })
                    })]
                })
            }
            let j = [{
                key: "ev",
                badge: "EV+",
                title: "Bet where the book is mispriced",
                summary: "We strip the vig from a sharp book to find the fair price, then flag every line another book is paying too much for.",
                why: "Positive EV means the odds are in your favor on every bet. Kelly sizing tells you how much to stake so the edge compounds.",
                who: "Volume bettors playing the long game. Single bets still lose; the profit shows up across hundreds of picks.",
                card: function() {
                    let e = (e, t, a) => (0, s.jsxs)("div", {
                            className: (0, m.cn)("flex flex-1 items-center justify-between gap-1 rounded-xl border px-2 py-1", a ? "border-emerald-200/40 bg-emerald-300/15" : "border-white/15 bg-white/10"),
                            children: [(0, s.jsx)("span", {
                                className: (0, m.cn)("text-[10px]", a ? "text-emerald-100/80" : "text-blue-100/70"),
                                children: e
                            }), (0, s.jsx)("span", {
                                className: (0, m.cn)("text-[11px] font-bold tabular-nums", a ? "text-emerald-100" : "text-white"),
                                children: t
                            })]
                        }),
                        t = (e, t, a, r, n) => (0, s.jsxs)("div", {
                            className: (0, m.cn)(w, "flex flex-col gap-1.5 p-2"),
                            children: [(0, s.jsx)("span", {
                                className: "text-[10px] uppercase tracking-wide text-blue-100/70",
                                children: e
                            }), (0, s.jsxs)("div", {
                                className: "flex items-center justify-between gap-1",
                                children: [(0, s.jsxs)("div", {
                                    className: "flex min-w-0 items-center gap-1.5",
                                    children: [(0, s.jsx)("span", {
                                        className: "rounded-md bg-white/90 p-[2px]",
                                        children: (0, s.jsx)(x.Z, {
                                            appName: t,
                                            size: 20
                                        })
                                    }), (0, s.jsx)("span", {
                                        className: "truncate text-[11px] font-medium text-blue-50",
                                        children: a
                                    })]
                                }), (0, s.jsx)("span", {
                                    className: (0, m.cn)("text-sm font-bold tabular-nums", n ? "text-emerald-200" : "text-white"),
                                    children: r
                                })]
                            })]
                        });
                    return (0, s.jsxs)(b, {
                        children: [(0, s.jsx)(f, {
                            playerId: "9m8m620nygtqd77",
                            imageUrl: "https://cdn.opticodds.com/player-logos/baseball/1229.png",
                            name: "Shohei Ohtani",
                            sport: "mlb",
                            market: "Over 1.5 Total Bases",
                            matchup: "LAD @ SF \xb7 Fri 9:45PM",
                            right: (0, s.jsxs)(s.Fragment, {
                                children: [(0, s.jsx)("span", {
                                    className: "text-lg font-bold tabular-nums text-emerald-200",
                                    children: "+6.13%"
                                }), (0, s.jsx)("span", {
                                    className: "text-[10px] text-blue-100/70",
                                    children: "expected value"
                                })]
                            })
                        }), (0, s.jsxs)("div", {
                            className: "grid grid-cols-2 gap-1.5",
                            children: [t("Bet at", "draftkings", "DraftKings", "+125", !0), t("Fair value", "pinnacle", "Pinnacle", "+112", !1)]
                        }), (0, s.jsxs)("div", {
                            className: "flex gap-1.5",
                            children: [e("Kelly 1x", "4.90%", !0), e("Width", "20"), e("Vig", "4%")]
                        })]
                    })
                }
            }, {
                key: "arbitrage",
                badge: "Arbitrage",
                title: "Locked-in profit no matter the outcome",
                summary: "Two books disagree on the same line. Bet both sides in the right split and one of them always cashes for more than you staked.",
                why: "Zero guessing. The card tells you exactly how much to put on each side, so the profit is locked before tip-off.",
                who: "Bettors with accounts at a few books who want steady, low-risk returns from volume rather than big swings.",
                card: function() {
                    return (0, s.jsxs)(b, {
                        children: [(0, s.jsx)(f, {
                            playerId: "giucurrgbx0xvjr",
                            imageUrl: "https://cdn.opticodds.com/player-logos/basketball/598845.png",
                            name: "LeBron James",
                            sport: "nba",
                            market: "24.5 Points",
                            matchup: "PHI @ BOS \xb7 Tue 7:30PM",
                            right: (0, s.jsxs)(s.Fragment, {
                                children: [(0, s.jsxs)("span", {
                                    className: "text-lg font-bold tabular-nums text-emerald-200",
                                    children: ["+", g(24.4)]
                                }), (0, s.jsx)("span", {
                                    className: "text-[10px] tabular-nums text-blue-100/70",
                                    children: "2.44% ROI \xb7 guaranteed"
                                })]
                            })
                        }), (0, s.jsxs)("div", {
                            className: "grid grid-cols-2 gap-1.5",
                            children: [(0, s.jsx)(v, {
                                label: "Over 24.5",
                                book: "draftkings",
                                price: "+110",
                                rows: [
                                    ["Bet", g(487.8)],
                                    ["Returns", g(1024.4), !0]
                                ]
                            }), (0, s.jsx)(v, {
                                label: "Under 24.5",
                                book: "pinnacle",
                                price: "+100",
                                rows: [
                                    ["Bet", g(512.2)],
                                    ["Returns", g(1024.4), !0]
                                ]
                            })]
                        })]
                    })
                }
            }, {
                key: "middles",
                badge: "Middles",
                title: "Win both bets when it lands in the gap",
                summary: "One book posts 7.5, another posts 9.5. Take the over on the low line and the under on the high one, and 8 or 9 pays out twice.",
                why: "Small risk, big payoff. Miss the gap and you lose only the vig; hit it and both legs win. Every card shows the hit odds you need.",
                who: "Bettors who like asymmetric spots and want a real edge on player props without sweating a single side.",
                card: function() {
                    return (0, s.jsxs)(b, {
                        children: [(0, s.jsx)(f, {
                            playerId: "33c5ict8f8367ws",
                            imageUrl: "https://cdn.opticodds.com/player-logos/basketball/598738.png",
                            name: "Jayson Tatum",
                            sport: "nba",
                            market: "Rebounds",
                            matchup: "BOS @ MIA \xb7 Wed 8:00PM",
                            right: (0, s.jsxs)(s.Fragment, {
                                children: [(0, s.jsxs)("span", {
                                    className: "text-lg font-bold tabular-nums text-emerald-200",
                                    children: ["+", g(93.05)]
                                }), (0, s.jsxs)("span", {
                                    className: "text-[10px] tabular-nums text-blue-100/70",
                                    children: [(0, s.jsx)("span", {
                                        className: "text-white",
                                        children: "24%"
                                    }), " to hit \xb7 need 4.7%"]
                                }), (0, s.jsx)("span", {
                                    className: "text-[10px] font-semibold tabular-nums text-emerald-200",
                                    children: "EV +18.9%"
                                })]
                            })
                        }), (0, s.jsxs)("div", {
                            className: "flex items-stretch gap-1.5",
                            children: [(0, s.jsxs)("div", {
                                className: (0, m.cn)(w, "flex w-12 shrink-0 flex-col items-center justify-center py-1"),
                                children: [(0, s.jsx)("span", {
                                    className: "text-[9px] uppercase tracking-wide text-blue-100/70",
                                    children: "Over"
                                }), (0, s.jsx)("span", {
                                    className: "text-xs font-bold tabular-nums",
                                    children: "7.5"
                                })]
                            }), (0, s.jsxs)("div", {
                                className: "relative flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200/40 bg-emerald-300/15 px-2 py-1.5",
                                children: [(0, s.jsx)("span", {
                                    className: "absolute left-2 top-0.5 text-[8px] uppercase tracking-wide text-emerald-100/80",
                                    children: "Both win"
                                }), [8, 9].map(e => (0, s.jsx)("span", {
                                    className: "grid h-5 min-w-5 place-items-center rounded bg-emerald-200/25 px-1 text-[11px] font-bold tabular-nums text-emerald-50",
                                    children: e
                                }, e))]
                            }), (0, s.jsxs)("div", {
                                className: (0, m.cn)(w, "flex w-12 shrink-0 flex-col items-center justify-center py-1"),
                                children: [(0, s.jsx)("span", {
                                    className: "text-[9px] uppercase tracking-wide text-blue-100/70",
                                    children: "Under"
                                }), (0, s.jsx)("span", {
                                    className: "text-xs font-bold tabular-nums",
                                    children: "9.5"
                                })]
                            })]
                        }), (0, s.jsxs)("div", {
                            className: "grid grid-cols-2 gap-1.5",
                            children: [(0, s.jsx)(v, {
                                label: "Over 7.5",
                                book: "fanduel",
                                price: "-110",
                                rows: [
                                    ["Bet", g(50)]
                                ]
                            }), (0, s.jsx)(v, {
                                label: "Under 9.5",
                                book: "betmgm",
                                price: "-105",
                                rows: [
                                    ["Bet", g(50)]
                                ]
                            })]
                        }), (0, s.jsxs)("div", {
                            className: "grid grid-cols-2 gap-1.5",
                            children: [(0, s.jsxs)("div", {
                                className: "flex items-center justify-between rounded-xl border border-emerald-200/40 bg-emerald-300/15 px-2 py-1",
                                children: [(0, s.jsx)("span", {
                                    className: "text-[10px] text-emerald-100/80",
                                    children: "Lands 8–9"
                                }), (0, s.jsxs)("span", {
                                    className: "text-[11px] font-bold tabular-nums text-emerald-100",
                                    children: ["+", g(93.05)]
                                })]
                            }), (0, s.jsxs)("div", {
                                className: (0, m.cn)(w, "flex items-center justify-between px-2 py-1"),
                                children: [(0, s.jsx)("span", {
                                    className: "text-[10px] text-blue-100/70",
                                    children: "Otherwise"
                                }), (0, s.jsxs)("span", {
                                    className: "text-[11px] font-bold tabular-nums text-white",
                                    children: ["-", g(4.55)]
                                })]
                            })]
                        })]
                    })
                }
            }];

            function y(e) {
                let {
                    onContinue: t,
                    continueLabel: a,
                    onDismiss: x
                } = e, h = (0, r.useRef)(null), [p, g] = (0, r.useState)(0), b = (0, r.useCallback)(e => {
                    let t = h.current;
                    if (!t) return;
                    let a = Math.max(0, Math.min(j.length - 1, e));
                    t.scrollTo({
                        left: a * t.clientWidth,
                        behavior: "smooth"
                    })
                }, []);
                (0, r.useEffect)(() => {
                    let e = h.current;
                    if (!e) return;
                    let t = 0,
                        a = () => {
                            cancelAnimationFrame(t), t = requestAnimationFrame(() => {
                                e.clientWidth && g(Math.round(e.scrollLeft / e.clientWidth))
                            })
                        };
                    return e.addEventListener("scroll", a, {
                        passive: !0
                    }), () => {
                        cancelAnimationFrame(t), e.removeEventListener("scroll", a)
                    }
                }, []);
                let f = p === j.length - 1;
                return (0, s.jsxs)("div", {
                    className: "flex min-h-0 flex-1 flex-col gap-3 sm:gap-4",
                    children: [(0, s.jsx)("div", {
                        className: "relative flex min-h-0 flex-1 flex-col",
                        onKeyDown: e => {
                            "ArrowRight" === e.key && b(p + 1), "ArrowLeft" === e.key && b(p - 1)
                        },
                        children: (0, s.jsx)("div", {
                            ref: h,
                            className: "flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-h-[28rem]",
                            "aria-roledescription": "carousel",
                            "aria-label": "What you get with Pro",
                            children: j.map((e, t) => {
                                let a = e.card;
                                return (0, s.jsx)("div", {
                                    className: "flex min-h-0 w-full shrink-0 snap-center flex-col px-px",
                                    role: "group",
                                    "aria-roledescription": "slide",
                                    "aria-label": "".concat(t + 1, " of ").concat(j.length, ": ").concat(e.badge),
                                    "aria-hidden": t !== p,
                                    children: (0, s.jsxs)("div", {
                                        className: "relative min-h-0 flex-1",
                                        children: [(0, s.jsxs)("div", {
                                            className: "flex max-h-full flex-col gap-2.5 overflow-y-auto overscroll-y-contain pb-3 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3",
                                            children: [(0, s.jsxs)("div", {
                                                className: "min-w-0 shrink-0",
                                                children: [(0, s.jsx)("p", {
                                                    className: "text-[11px] font-semibold text-blue-300",
                                                    children: e.badge
                                                }), (0, s.jsx)("h3", {
                                                    className: "text-base font-bold leading-tight text-white",
                                                    children: e.title
                                                })]
                                            }), (0, s.jsx)("div", {
                                                className: "shrink-0",
                                                children: (0, s.jsx)(a, {})
                                            }), (0, s.jsxs)("div", {
                                                className: "flex flex-col gap-2.5 sm:gap-3",
                                                children: [(0, s.jsx)("p", {
                                                    className: "text-xs leading-5 text-slate-300",
                                                    children: e.summary
                                                }), (0, s.jsxs)("div", {
                                                    className: "grid gap-1.5",
                                                    children: [(0, s.jsxs)("div", {
                                                        className: "flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2",
                                                        children: [(0, s.jsx)(n.Z, {
                                                            className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300"
                                                        }), (0, s.jsxs)("div", {
                                                            className: "min-w-0",
                                                            children: [(0, s.jsx)("p", {
                                                                className: "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6F7280]",
                                                                children: "Why it matters"
                                                            }), (0, s.jsx)("p", {
                                                                className: "text-xs leading-5 text-slate-300",
                                                                children: e.why
                                                            })]
                                                        })]
                                                    }), (0, s.jsxs)("div", {
                                                        className: "flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2",
                                                        children: [(0, s.jsx)(l.Z, {
                                                            className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300"
                                                        }), (0, s.jsxs)("div", {
                                                            className: "min-w-0",
                                                            children: [(0, s.jsx)("p", {
                                                                className: "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6F7280]",
                                                                children: "Who it's for"
                                                            }), (0, s.jsx)("p", {
                                                                className: "text-xs leading-5 text-slate-300",
                                                                children: e.who
                                                            })]
                                                        })]
                                                    })]
                                                })]
                                            })]
                                        }), (0, s.jsx)("div", {
                                            className: "pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#030712] to-transparent"
                                        })]
                                    })
                                }, e.key)
                            })
                        })
                    }), (0, s.jsxs)("div", {
                        className: "flex shrink-0 items-center justify-center gap-3",
                        children: [(0, s.jsx)("button", {
                            type: "button",
                            onClick: () => b(p - 1),
                            disabled: 0 === p,
                            "aria-label": "Previous feature",
                            className: "grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:bg-white/[0.04]",
                            children: (0, s.jsx)(i.Z, {
                                className: "h-3.5 w-3.5"
                            })
                        }), (0, s.jsx)("div", {
                            className: "flex items-center gap-1.5",
                            role: "tablist",
                            "aria-label": "Feature",
                            children: j.map((e, t) => (0, s.jsx)("button", {
                                type: "button",
                                role: "tab",
                                "aria-selected": t === p,
                                "aria-label": e.badge,
                                onClick: () => b(t),
                                className: (0, m.cn)("h-1.5 rounded-full transition-all", t === p ? "w-5 bg-[#3461FF]" : "w-1.5 bg-white/20 hover:bg-white/40")
                            }, e.key))
                        }), (0, s.jsx)("button", {
                            type: "button",
                            onClick: () => b(p + 1),
                            disabled: f,
                            "aria-label": "Next feature",
                            className: "grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:bg-white/[0.04]",
                            children: (0, s.jsx)(o.Z, {
                                className: "h-3.5 w-3.5"
                            })
                        })]
                    }), t ? (0, s.jsxs)("div", {
                        className: "flex shrink-0 flex-col gap-2",
                        children: [(0, s.jsxs)(u.z, {
                            variant: "blue",
                            className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                            onClick: f ? t : () => b(p + 1),
                            children: [f ? a : "Next", (0, s.jsx)(d.Z, {
                                className: "ml-2 h-4 w-4"
                            })]
                        }), x ? (0, s.jsxs)("button", {
                            type: "button",
                            onClick: x,
                            className: "mx-auto inline-flex items-center gap-1 text-xs font-medium text-[#8d93aa] transition-colors hover:text-white",
                            children: [(0, s.jsx)(c.Z, {
                                className: "h-3.5 w-3.5"
                            }), "Not now"]
                        }) : null]
                    }) : null]
                })
            }
        },
        44209: function(e, t, a) {
            a.d(t, {
                IY: function() {
                    return C
                },
                N3: function() {
                    return S
                },
                So: function() {
                    return _
                }
            });
            var s = a(10131),
                r = a(55185),
                n = a(69237),
                l = a(69948),
                i = a(67057),
                o = a(65998),
                d = a(67093),
                c = a(40046),
                x = a(70333),
                u = a(59564),
                h = a(66961),
                p = a(40122),
                m = a(50761),
                g = a(7357),
                b = a(69687),
                f = a(63855),
                w = a(6094),
                v = a(3820),
                j = a(58685),
                y = a(28876),
                N = a(92655),
                k = a(36839),
                P = a(76623);

            function _(e) {
                let {
                    open: t,
                    onOpenChange: a,
                    title: r,
                    description: n,
                    scroll: l = !0,
                    children: i
                } = e;
                return (0, s.jsx)(f.Vq, {
                    open: t,
                    onOpenChange: a,
                    children: (0, s.jsx)(f.cZ, {
                        className: "border-0 bg-transparent p-0 text-slate-200 shadow-none sm:max-w-[28rem]",
                        children: (0, s.jsx)("div", {
                            className: "relative isolate w-full overflow-hidden rounded-xl shadow-[0_5px_15px_0_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(0,0,0,0.20),0_0_0_1px_rgba(255,255,255,0.07)]",
                            children: (0, s.jsxs)("div", {
                                className: (0, j.cn)("relative z-10 -mx-px -mt-px flex max-h-[calc(100dvh-1.5rem)] flex-col items-stretch justify-start gap-4 rounded-lg border-0 bg-[#030712] px-4 py-5 text-center shadow-[0_0_2px_0_rgba(0,0,0,0.08),0_1px_2px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(255,255,255,0.03)] sm:gap-5 sm:px-7 sm:py-7", l ? "overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "overflow-hidden"),
                                children: [(0, s.jsx)("div", {
                                    className: "mx-auto flex h-9 w-9 shrink-0 items-center justify-center sm:h-12 sm:w-12",
                                    children: (0, s.jsx)(w.Z, {
                                        width: 48,
                                        height: 48,
                                        className: "h-full w-full drop-shadow-[0_10px_30px_rgba(52,97,255,0.5)]"
                                    })
                                }), (0, s.jsxs)("div", {
                                    className: "flex shrink-0 flex-col gap-2",
                                    children: [(0, s.jsx)("h2", {
                                        className: "text-lg font-bold text-white",
                                        children: r
                                    }), (0, s.jsx)("p", {
                                        className: "text-sm leading-5 text-gray-500",
                                        children: n
                                    })]
                                }), i]
                            })
                        })
                    })
                })
            }

            function F(e) {
                let {
                    steps: t
                } = e;
                return (0, s.jsx)("ol", {
                    className: "relative flex flex-col gap-0 text-left",
                    children: t.map((e, a) => {
                        let r = e.icon,
                            n = a === t.length - 1;
                        return (0, s.jsxs)("li", {
                            className: "relative flex gap-3 pb-4 last:pb-0",
                            children: [n ? null : (0, s.jsx)("span", {
                                "aria-hidden": !0,
                                className: "absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-[#3461FF]/60 to-white/[0.08]"
                            }), (0, s.jsx)("span", {
                                className: (0, j.cn)("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border", "now" === e.tone && "border-[#3461FF]/60 bg-[#3461FF] text-white shadow-[0_8px_20px_-10px_rgba(52,97,255,0.9)]", "mid" === e.tone && "border-white/[0.1] bg-white/[0.05] text-[#AFB2C0]", "end" === e.tone && "border-blue-300/25 bg-blue-500/10 text-blue-200"),
                                children: (0, s.jsx)(r, {
                                    className: "h-3.5 w-3.5"
                                })
                            }), (0, s.jsxs)("div", {
                                className: "min-w-0 pt-1",
                                children: [(0, s.jsx)("p", {
                                    className: "text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F7280]",
                                    children: e.when
                                }), (0, s.jsx)("p", {
                                    className: "text-sm font-semibold text-white",
                                    children: e.title
                                }), (0, s.jsx)("p", {
                                    className: "text-xs leading-5 text-[#8d93aa]",
                                    children: e.detail
                                })]
                            })]
                        }, e.title)
                    })
                })
            }

            function S(e) {
                var t, a, l, m;
                let {
                    open: f,
                    onOpenChange: w,
                    source: j
                } = e, S = "pro_launch_update" === j, {
                    user: C,
                    isLoaded: A,
                    isSignedIn: T
                } = (0, n.aF)(), Z = (0, i.useRouter)(), E = (0, P.l)(), M = null !== (t = null == C ? void 0 : C.publicMetadata) && void 0 !== t ? t : null, Y = (0, r.useMemo)(() => (0, y.qH)(M), [M]), [B, U] = (0, r.useState)(null), [O, z] = (0, r.useState)(!1), [I, D] = (0, r.useState)(!1), [L, V] = (0, r.useState)(null), [W, R] = (0, r.useState)("features"), q = null !== (l = null !== (a = null == B ? void 0 : B.provider) && void 0 !== a ? a : Y.billingProvider) && void 0 !== l ? l : null, K = null !== (m = null == B ? void 0 : B.currentInterval) && void 0 !== m ? m : "monthly", H = k.Qu.pro[K].price;
                (0, r.useEffect)(() => {
                    f && R("features")
                }, [f]), (0, r.useEffect)(() => {
                    if (!f || !A || !T) return;
                    let e = !1;
                    return z(!0), V(null), (0, N.w2)().then(t => {
                        e || U(t)
                    }).catch(t => {
                        e || V(t instanceof N.tS ? t.code : "network_error")
                    }).finally(() => {
                        e || z(!1)
                    }), () => {
                        e = !0
                    }
                }, [f, A, T]);
                let J = async () => {
                    D(!0), V(null);
                    try {
                        let t = await (0, N.u3)();
                        if (await E(), t.alreadyPro) g.Am.success("You already have Pro.");
                        else if ("stripe" === t.provider) {
                            var e;
                            g.Am.success("Pro trial started. ".concat((0, k.T4)(null !== (e = t.chargeAmount) && void 0 !== e ? e : H), " on ").concat((0, N.XL)(t.chargeDate), " unless you opt out."))
                        } else g.Am.success("Pro trial started — ends ".concat((0, N.XL)(t.trialEndsAt), "."));
                        w(!1), Z.push("/arbitrage")
                    } catch (e) {
                        e instanceof N.tS ? "not_eligible" === e.code ? V("trial_used" === e.data.reason ? "You have already used your Pro trial." : "Your account is not eligible for the trial.") : "trial_in_progress" === e.code ? V("A trial is already running on your subscription.") : "subscription_not_active" === e.code ? V(e.data.cancelAtPeriodEnd ? "Your subscription is set to cancel. Reactivate it from Manage Billing, then start the trial." : "Your last payment did not go through. Update your card in Manage Billing, then start the trial.") : "trial_unsynced" === e.code ? V("Your trial started but we could not save it. Please try again.") : "no_active_subscription" === e.code || "subscription_required" === e.code ? V("We could not find an active subscription on your account.") : V("Something went wrong starting your trial. Please try again.") : V("Something went wrong starting your trial. Please try again.")
                    } finally {
                        D(!1)
                    }
                };
                if (!A) return null;
                let X = new Date(Date.now() + 864e5 * y.Vf),
                    G = (0, N.XL)(X),
                    Q = "stripe" === q || "both" === q,
                    $ = "".concat((0, k.T4)(H)).concat(k.V0[K].shortSuffix),
                    ee = [{
                        icon: o.Z,
                        when: "Today",
                        title: "Pro unlocks instantly",
                        detail: "Arbitrage, Middles and EV+ open the moment you start. Nothing is charged.",
                        tone: "now"
                    }, {
                        icon: d.Z,
                        when: "Day ".concat(y.Vf - 1),
                        title: Q ? "Change your mind anytime" : "Keep exploring the boards",
                        detail: Q ? "Opt out from the Pro badge in the sidebar and you go straight back to Premium with no Pro charge." : "Use the edge tools on live slates and see what you’d be keeping.",
                        tone: "mid"
                    }, Q ? {
                        icon: c.Z,
                        when: "".concat(G, " \xb7 trial ends"),
                        title: "Pro continues at ".concat($),
                        detail: "Billed to your card on file. Your unused Premium days are credited toward it.",
                        tone: "end"
                    } : {
                        icon: x.Z,
                        when: "".concat(G, " \xb7 trial ends"),
                        title: "Pro locks unless you upgrade",
                        detail: "revenuecat" === q ? "Your Apple subscription is untouched. Upgrade to Pro in the app to keep the boards." : "You keep Premium exactly as it is. Upgrade whenever you want the boards back.",
                        tone: "end"
                    }];
                return "features" === W ? (0, s.jsx)(_, {
                    open: f,
                    onOpenChange: w,
                    title: S ? "Introducing Pro" : "What you get with Pro",
                    description: S ? "Three new edge tools on top of everything in Premium, and a free ".concat(y.Vf, "-day trial to try them. Swipe through to see each one.") : "Three edge tools on top of everything in Premium. Swipe through to see each one.",
                    scroll: !1,
                    children: (0, s.jsx)(v.w, {
                        continueLabel: "Try it free for ".concat(y.Vf, " days"),
                        onContinue: () => R("trial"),
                        onDismiss: () => w(!1)
                    })
                }) : (0, s.jsxs)(_, {
                    open: f,
                    onOpenChange: w,
                    title: "Try Pro free for ".concat(y.Vf, " days"),
                    description: "The cross-book edge tools on top of everything in Premium.",
                    children: [(0, s.jsx)("div", {
                        className: "flex flex-wrap justify-center gap-1.5",
                        children: y.vR.pro.map(e => (0, s.jsxs)("span", {
                            className: "inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300",
                            children: [(0, s.jsx)(u.Z, {
                                className: "h-3 w-3 text-blue-300"
                            }), e]
                        }, e))
                    }), (0, s.jsx)("div", {
                        className: "rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4",
                        children: O && !B ? (0, s.jsxs)("div", {
                            className: "flex items-center justify-center gap-2 py-6 text-xs text-slate-400",
                            children: [(0, s.jsx)(h.Z, {
                                className: "h-3.5 w-3.5 animate-spin text-blue-300"
                            }), "Checking your billing"]
                        }) : (0, s.jsx)(F, {
                            steps: ee
                        })
                    }), L ? (0, s.jsx)("div", {
                        className: "rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-left text-xs leading-5 text-red-200",
                        children: L
                    }) : null, (0, s.jsxs)("div", {
                        className: "flex flex-col gap-2",
                        children: [(0, s.jsxs)(b.z, {
                            variant: "blue",
                            className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                            onClick: J,
                            disabled: I || O || !Y.isTrialEligible,
                            children: [I ? (0, s.jsx)(h.Z, {
                                className: "mr-2 h-4 w-4 animate-spin"
                            }) : null, I ? "Starting…" : "Start free trial"]
                        }), (0, s.jsx)("p", {
                            className: "text-[11px] leading-4 text-[#6F7280]",
                            children: Q ? "No charge today \xb7 ".concat($, " on ").concat(G, " unless you opt out") : "No charge today \xb7 Nothing is billed when the trial ends"
                        }), (0, s.jsxs)("button", {
                            type: "button",
                            onClick: () => w(!1),
                            className: "mx-auto inline-flex items-center gap-1 text-xs font-medium text-[#8d93aa] transition-colors hover:text-white",
                            children: [(0, s.jsx)(p.Z, {
                                className: "h-3.5 w-3.5"
                            }), "Not now"]
                        })]
                    })]
                })
            }

            function C(e) {
                var t, a;
                let {
                    open: i,
                    onOpenChange: o,
                    onUpgrade: d
                } = e, {
                    user: c,
                    isLoaded: x,
                    isSignedIn: u
                } = (0, n.aF)(), {
                    getToken: g
                } = (0, l.y)(), f = null !== (t = null == c ? void 0 : c.publicMetadata) && void 0 !== t ? t : null, w = (0, r.useMemo)(() => (0, y.qH)(f), [f]), [j, P] = (0, r.useState)(null), [F, S] = (0, r.useState)(!1), [C, A] = (0, r.useState)(null), [T, Z] = (0, r.useState)(!1), E = "stripe" === w.trialProvider, M = null !== (a = null == j ? void 0 : j.currentInterval) && void 0 !== a ? a : "monthly", Y = k.Qu.pro[M].price, B = (0, N.XL)(w.trialEndsAt);
                (0, r.useEffect)(() => {
                    i || Z(!1)
                }, [i]), (0, r.useEffect)(() => {
                    if (!i || !x || !u || !E) return;
                    let e = !1;
                    return A(null), (0, N.w2)().then(t => {
                        e || P(t)
                    }).catch(() => void 0), () => {
                        e = !0
                    }
                }, [i, x, u, E]);
                let U = async () => {
                    S(!0), A(null);
                    try {
                        await (0, N.YI)(), await g({
                            skipCache: !0
                        }).catch(() => void 0), o(!1), window.location.reload()
                    } catch (e) {
                        e instanceof N.tS && "trial_not_active" === e.code ? A("This trial has already converted or ended — manage your plan from Manage Billing.") : A("Something went wrong. Please try again or email support@pickfinder.app.")
                    } finally {
                        S(!1)
                    }
                };
                if (!x) return null;
                let O = E && !w.trialOptedOut,
                    z = O ? "Pro continues on ".concat(B, " for ").concat((0, k.T4)(Y)).concat(k.V0[M].shortSuffix, ", charged to your card on file.") : "Pro is yours until ".concat(B, ". After that it locks unless you upgrade.");
                return T ? (0, s.jsxs)(_, {
                    open: i,
                    onOpenChange: o,
                    title: "End your Pro trial?",
                    description: "This switches you back to Premium immediately. The Pro boards lock right away. Your Premium billing restarts from today with any unused days credited.",
                    scroll: !1,
                    children: [C ? (0, s.jsx)("div", {
                        className: "shrink-0 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-left text-xs leading-5 text-red-200",
                        children: C
                    }) : null, (0, s.jsxs)("div", {
                        className: "flex shrink-0 flex-col gap-2",
                        children: [(0, s.jsx)(b.z, {
                            variant: "blue",
                            className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                            onClick: () => o(!1),
                            disabled: F,
                            children: "Keep Pro"
                        }), (0, s.jsxs)(b.z, {
                            variant: "outline",
                            className: "h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white shadow-none hover:bg-white/[0.08] hover:text-white",
                            onClick: U,
                            disabled: F,
                            children: [F ? (0, s.jsx)(h.Z, {
                                className: "mr-2 h-4 w-4 animate-spin"
                            }) : null, F ? "Ending Pro…" : "Yes, end trial now"]
                        })]
                    })]
                }) : (0, s.jsxs)(_, {
                    open: i,
                    onOpenChange: o,
                    title: O ? "Your Pro trial is on" : "Your Pro trial",
                    description: z,
                    scroll: !1,
                    children: [(0, s.jsx)(v.w, {}), C ? (0, s.jsx)("div", {
                        className: "shrink-0 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-left text-xs leading-5 text-red-200",
                        children: C
                    }) : null, (0, s.jsx)("div", {
                        className: "flex shrink-0 flex-col gap-2",
                        children: O ? (0, s.jsxs)(s.Fragment, {
                            children: [(0, s.jsx)(b.z, {
                                variant: "blue",
                                className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                                onClick: () => o(!1),
                                children: "Keep Pro"
                            }), (0, s.jsx)(b.z, {
                                variant: "outline",
                                className: "h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white shadow-none hover:bg-white/[0.08] hover:text-white",
                                onClick: () => {
                                    A(null), Z(!0)
                                },
                                children: "End trial now"
                            })]
                        }) : (0, s.jsxs)(s.Fragment, {
                            children: [(0, s.jsxs)(b.z, {
                                variant: "blue",
                                className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                                onClick: d,
                                children: [(0, s.jsx)(m.Z, {
                                    className: "mr-2 h-4 w-4"
                                }), "Keep Pro"]
                            }), (0, s.jsxs)("button", {
                                type: "button",
                                onClick: () => o(!1),
                                className: "mx-auto inline-flex items-center gap-1 text-xs font-medium text-[#8d93aa] transition-colors hover:text-white",
                                children: [(0, s.jsx)(p.Z, {
                                    className: "h-3.5 w-3.5"
                                }), "Close"]
                            })]
                        })
                    })]
                })
            }
        },
        14375: function(e, t, a) {
            a.d(t, {
                FY: function() {
                    return F
                },
                Hx: function() {
                    return _
                },
                Vd: function() {
                    return P
                }
            });
            var s = a(10131),
                r = a(41915),
                n = a(55185),
                l = a(69237),
                i = a(66961),
                o = a(86128),
                d = a(59564),
                c = a(50761),
                x = a(40122),
                u = a(7357),
                h = a(69687),
                p = a(3820),
                m = a(44209),
                g = a(28876),
                b = a(92655),
                f = a(36839),
                w = a(59160),
                v = a(76623),
                j = a(58685);
            let y = "pickfinder:pending-pro-upgrade",
                N = "https://apps.apple.com/account/subscriptions";

            function k() {
                try {
                    window.sessionStorage.setItem(y, JSON.stringify({
                        createdAt: Date.now()
                    }))
                } catch (e) {}
            }

            function P() {
                try {
                    let e = window.sessionStorage.getItem(y);
                    if (!e) return !1;
                    let t = JSON.parse(e),
                        a = "number" == typeof t.createdAt && Date.now() - t.createdAt < 18e5;
                    return a || window.sessionStorage.removeItem(y), a
                } catch (e) {
                    return !1
                }
            }

            function _() {
                try {
                    window.sessionStorage.removeItem(y)
                } catch (e) {}
            }

            function F(e) {
                var t, a, y, P;
                let _, {
                        open: F,
                        onOpenChange: S,
                        defaultInterval: C,
                        source: A,
                        onUpgraded: T
                    } = e,
                    {
                        user: Z,
                        isLoaded: E,
                        isSignedIn: M
                    } = (0, l.aF)(),
                    {
                        isWebViewApp: Y
                    } = (0, w.B)(),
                    B = (0, v.l)(),
                    U = null !== (t = null == Z ? void 0 : Z.publicMetadata) && void 0 !== t ? t : null,
                    O = (0, n.useMemo)(() => (0, g.qH)(U), [U]),
                    [z, I] = (0, n.useState)(null),
                    [D, L] = (0, n.useState)(null),
                    [V, W] = (0, n.useState)(!1),
                    [R, q] = (0, n.useState)(null != C ? C : "monthly"),
                    [K, H] = (0, n.useState)(!1),
                    [J, X] = (0, n.useState)(null),
                    [G, Q] = (0, n.useState)("features"),
                    $ = null !== (y = null !== (a = null == z ? void 0 : z.provider) && void 0 !== a ? a : O.billingProvider) && void 0 !== y ? y : "none",
                    ee = null !== (P = null == z ? void 0 : z.currentInterval) && void 0 !== P ? P : null;
                (0, n.useEffect)(() => {
                    F && Q("features")
                }, [F]), (0, n.useEffect)(() => {
                    if (!F || !E || !M) return;
                    let e = !1;
                    return W(!0), L(null), X(null), (0, b.w2)().then(t => {
                        e || (I(t), !C && t.currentInterval && q(t.currentInterval))
                    }).catch(t => {
                        e || L(t instanceof b.tS ? t.code : "network_error")
                    }).finally(() => {
                        e || W(!1)
                    }), () => {
                        e = !0
                    }
                }, [F, E, M, C]), (0, n.useEffect)(() => {
                    C && q(C)
                }, [C]);
                let et = async () => {
                        H(!0), X(null);
                        try {
                            let e = await (0, b.$t)(R);
                            await B(), u.Am.success(e.alreadyPro ? "You already have Pro." : "You're on PickFinder Pro."), S(!1), null == T || T()
                        } catch (e) {
                            e instanceof b.tS ? "payment_failed" === e.code ? X({
                                message: "string" == typeof e.data.message ? e.data.message : "Your card was declined.",
                                portalUrl: "string" == typeof e.data.portalUrl ? e.data.portalUrl : null
                            }) : "trial_in_progress" === e.code ? X({
                                message: "Your Pro trial is already running — it continues automatically."
                            }) : "subscription_not_active" === e.code ? X({
                                message: e.data.cancelAtPeriodEnd ? "Your subscription is set to cancel. Reactivate it from Manage Billing, then upgrade." : "Your last payment did not go through. Update your card in Manage Billing, then upgrade."
                            }) : "no_active_stripe_subscription" === e.code ? (I(e => e ? { ...e,
                                provider: "none"
                            } : e), X({
                                message: "We could not find an active subscription to upgrade."
                            })) : X({
                                message: "Something went wrong. Please try again or email support@pickfinder.app."
                            }) : X({
                                message: "Something went wrong. Please try again."
                            })
                        } finally {
                            H(!1)
                        }
                    },
                    ea = () => {
                        Z && (function(e) {
                            var t;
                            let {
                                userId: a
                            } = e, s = null === (t = window.webkit) || void 0 === t ? void 0 : t.messageHandlers;
                            return (null == s ? void 0 : s.showPaywall) ? (k(), s.showPaywall.postMessage({
                                id: a,
                                offering: "pro"
                            }), !0) : (null == s ? void 0 : s.userLogin) ? (k(), s.userLogin.postMessage({
                                id: a,
                                plan: "None"
                            }), !0) : (console.warn("[ProUpgradeDialog] Native paywall handler is unavailable."), !1)
                        }({
                            userId: Z.id
                        }) ? S(!1) : X({
                            message: "Please update the PickFinder app to upgrade to Pro."
                        }))
                    },
                    es = e => {
                        window.open(e, "_blank", "noopener,noreferrer")
                    };
                if (!E) return null;
                if ("features" === G && !O.isComped) return (0, s.jsx)(m.So, {
                    open: F,
                    onOpenChange: S,
                    title: "pro_launch_update" === A ? "Introducing Pro" : "What you get with Pro",
                    description: "pro_launch_update" === A ? "Three new edge tools on top of everything in Premium. Swipe through to see each one." : "Three edge tools on top of everything in Premium. Swipe through to see each one.",
                    scroll: !1,
                    children: (0, s.jsx)(p.w, {
                        continueLabel: "Continue to upgrade",
                        onContinue: () => Q("upgrade"),
                        onDismiss: () => S(!1)
                    })
                });
                let er = "both" === $ || (null == z ? void 0 : z.hasRevenueCatActive) && "stripe" === $,
                    en = (0, f.BP)("pro", R),
                    el = f.Qu.pro[R],
                    ei = null !== ee && ee !== R;
                return _ = M ? O.isComped ? (0, s.jsx)("p", {
                    className: "text-sm text-slate-300",
                    children: "You already have Pro. Enjoy."
                }) : V && !z ? (0, s.jsxs)("div", {
                    className: "flex items-center justify-center gap-2 py-4 text-sm text-slate-400",
                    children: [(0, s.jsx)(i.Z, {
                        className: "h-4 w-4 animate-spin text-blue-300"
                    }), "Checking your subscription"]
                }) : "subscription_required" === D ? (0, s.jsx)(h.z, {
                    asChild: !0,
                    variant: "blue",
                    className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                    children: (0, s.jsx)(r.default, {
                        href: en ? "/purchase?plan=".concat(en) : "/pricing",
                        onClick: () => S(!1),
                        children: "Get PickFinder Pro"
                    })
                }) : D ? (0, s.jsxs)("div", {
                    className: "flex flex-col gap-2",
                    children: [(0, s.jsx)("p", {
                        className: "text-sm text-red-300",
                        children: "We couldn't load your billing details."
                    }), (0, s.jsx)(h.z, {
                        variant: "outline",
                        className: "h-11 rounded-2xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white",
                        onClick: () => {
                            L(null), I(null), S(!1), setTimeout(() => S(!0), 0)
                        },
                        children: "Try again"
                    })]
                }) : "stripe" === $ || "both" === $ ? Y ? (0, s.jsxs)("div", {
                    className: "flex flex-col gap-3",
                    children: [(0, s.jsx)("p", {
                        className: "text-sm leading-5 text-slate-300",
                        children: "Your subscription is billed through pickfinder.app. Open the site in your browser to switch to Pro — it takes one tap and your card on file is used."
                    }), (0, s.jsxs)(h.z, {
                        variant: "blue",
                        className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                        onClick: () => es("".concat(window.location.origin).concat(g.MP, "?interval=").concat(R)),
                        children: [(0, s.jsx)(o.Z, {
                            className: "mr-2 h-4 w-4"
                        }), "Upgrade on the web"]
                    })]
                }) : (0, s.jsxs)("div", {
                    className: "flex flex-col gap-2",
                    role: "radiogroup",
                    "aria-label": "Choose a Pro plan",
                    children: [f.K.map(e => {
                        let t = f.V0[e],
                            a = f.Qu.pro[e],
                            r = (0, f.he)("pro", e),
                            n = R === e,
                            l = ee === e;
                        return (0, s.jsxs)("button", {
                            type: "button",
                            role: "radio",
                            "aria-checked": n,
                            onMouseDown: e => e.preventDefault(),
                            onClick: () => q(e),
                            className: (0, j.cn)("group/plan relative flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all !outline-none !ring-0", n ? "border-[#3461FF]/70 bg-[#3461FF]/14 shadow-[0_10px_32px_-20px_rgba(52,97,255,0.85)]" : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.055]"),
                            children: [(0, s.jsxs)("span", {
                                className: "min-w-0 flex-1",
                                children: [(0, s.jsxs)("span", {
                                    className: "flex min-w-0 items-center gap-2",
                                    children: [(0, s.jsx)("span", {
                                        className: "truncate text-sm font-semibold text-[#d8dceb]",
                                        children: t.label
                                    }), r ? (0, s.jsx)("span", {
                                        className: (0, j.cn)("shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", "yearly" === e ? "bg-[#3461FF] text-white" : "bg-[#89A3FF] text-[#0B2271]"),
                                        children: r
                                    }) : null, l ? (0, s.jsx)("span", {
                                        className: "shrink-0 rounded-md border border-white/[0.1] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#AFB2C0]",
                                        children: "Your cycle"
                                    }) : null]
                                }), (0, s.jsx)("span", {
                                    className: "mt-1 block truncate text-xs text-[#8d93aa]",
                                    children: l ? "Keeps your current billing date" : "Billing date resets to today"
                                })]
                            }), (0, s.jsxs)("span", {
                                className: "shrink-0 text-right",
                                children: [(0, s.jsx)("span", {
                                    className: "text-lg font-semibold tabular-nums text-white",
                                    children: (0, f.T4)(a.price)
                                }), (0, s.jsx)("span", {
                                    className: "ml-1 text-[11px] text-[#AFB2C0]",
                                    children: t.shortSuffix
                                })]
                            }), (0, s.jsx)("span", {
                                className: (0, j.cn)("ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors", n ? "border-[#6f8dff] bg-[#3461FF] text-white" : "border-white/[0.14] bg-transparent text-transparent"),
                                children: (0, s.jsx)(d.Z, {
                                    className: "h-3.5 w-3.5"
                                })
                            })]
                        }, e)
                    }), (0, s.jsxs)("p", {
                        className: "text-xs leading-5 text-[#8d93aa]",
                        children: ["You're charged the prorated difference today using your card on file", ei ? ", and your billing date resets to today" : "", ". Downgrade anytime from Manage Billing."]
                    }), (0, s.jsxs)(h.z, {
                        variant: "blue",
                        className: "mt-1 h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                        onClick: et,
                        disabled: K,
                        children: [K ? (0, s.jsx)(i.Z, {
                            className: "mr-2 h-4 w-4 animate-spin"
                        }) : (0, s.jsx)(c.Z, {
                            className: "mr-2 h-4 w-4"
                        }), K ? "Upgrading…" : "Upgrade now \xb7 ".concat((0, f.T4)(el.price)).concat(f.V0[R].shortSuffix)]
                    })]
                }) : "revenuecat" === $ ? Y ? (0, s.jsxs)(h.z, {
                    variant: "blue",
                    className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                    onClick: ea,
                    children: [(0, s.jsx)(c.Z, {
                        className: "mr-2 h-4 w-4"
                    }), "Upgrade now"]
                }) : (0, s.jsxs)("div", {
                    className: "flex flex-col gap-3",
                    children: [(0, s.jsx)("p", {
                        className: "text-sm leading-5 text-slate-300",
                        children: "Your subscription is billed through Apple. Pick a PickFinder Pro plan under Manage Subscriptions and Apple switches you over, prorating what you've already paid."
                    }), (0, s.jsxs)(h.z, {
                        variant: "blue",
                        className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                        onClick: () => es(N),
                        children: [(0, s.jsx)(o.Z, {
                            className: "mr-2 h-4 w-4"
                        }), "Upgrade in the App Store"]
                    })]
                }) : Y ? (0, s.jsx)(h.z, {
                    variant: "blue",
                    className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                    onClick: ea,
                    children: "Get PickFinder Pro"
                }) : (0, s.jsx)(h.z, {
                    asChild: !0,
                    variant: "blue",
                    className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                    children: (0, s.jsx)(r.default, {
                        href: en ? "/purchase?plan=".concat(en) : "/pricing",
                        onClick: () => S(!1),
                        children: "Get PickFinder Pro"
                    })
                }) : (0, s.jsx)(h.z, {
                    asChild: !0,
                    variant: "blue",
                    className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                    children: (0, s.jsx)(r.default, {
                        href: g.MP,
                        children: "Sign in to upgrade"
                    })
                }), (0, s.jsxs)(m.So, {
                    open: F,
                    onOpenChange: S,
                    title: "Upgrade to PickFinder Pro",
                    description: "Arbitrage, Middles and EV+ on top of everything in Premium.",
                    children: [(0, s.jsx)("div", {
                        className: "grid grid-cols-3 gap-2 text-left",
                        children: g.vR.pro.map(e => (0, s.jsxs)("div", {
                            className: "flex min-w-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-300",
                            children: [(0, s.jsx)(d.Z, {
                                className: "h-3.5 w-3.5 shrink-0 text-blue-300"
                            }), (0, s.jsx)("span", {
                                className: "truncate",
                                children: e
                            })]
                        }, e))
                    }), _, J ? (0, s.jsxs)("div", {
                        className: "rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-left text-xs leading-5 text-red-200",
                        children: [J.message, J.portalUrl ? (0, s.jsxs)(s.Fragment, {
                            children: [" ", (0, s.jsx)("a", {
                                className: "font-semibold text-[#9eb2ff] underline",
                                href: J.portalUrl,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                children: "Update your card"
                            }), " ", "and try again."]
                        }) : null]
                    }) : null, er ? (0, s.jsxs)("p", {
                        className: "text-xs leading-5 text-[#8d93aa]",
                        children: ["You also have a PickFinder subscription through Apple. Upgrading here doesn't change that one — manage it in", " ", (0, s.jsx)("a", {
                            className: "font-semibold text-[#9eb2ff]",
                            href: N,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            children: "Apple subscriptions"
                        }), "."]
                    }) : null, (0, s.jsxs)("button", {
                        type: "button",
                        onClick: () => S(!1),
                        className: "mx-auto inline-flex items-center gap-1 text-xs font-medium text-[#8d93aa] transition-colors hover:text-white",
                        children: [(0, s.jsx)(x.Z, {
                            className: "h-3.5 w-3.5"
                        }), "Not now"]
                    })]
                })
            }
        },
        76623: function(e, t, a) {
            a.d(t, {
                l: function() {
                    return i
                }
            });
            var s = a(55185),
                r = a(69948),
                n = a(69237),
                l = a(67057);

            function i() {
                let {
                    getToken: e
                } = (0, r.y)(), {
                    user: t
                } = (0, n.aF)(), a = (0, l.useRouter)();
                return (0, s.useCallback)(async () => {
                    await e({
                        skipCache: !0
                    }).catch(() => void 0), await (null == t ? void 0 : t.reload().catch(() => void 0)), a.refresh()
                }, [e, a, t])
            }
        },
        92655: function(e, t, a) {
            a.d(t, {
                $t: function() {
                    return l
                },
                XL: function() {
                    return d
                },
                YI: function() {
                    return o
                },
                tS: function() {
                    return s
                },
                u3: function() {
                    return i
                },
                w2: function() {
                    return n
                }
            });
            class s extends Error {
                constructor(e, t, a = {}) {
                    super(t), this.status = e, this.code = t, this.data = a
                }
            }
            async function r(e, t) {
                var a, r;
                let n = await fetch(e, { ...t,
                    redirect: "manual",
                    headers: {
                        "Content-Type": "application/json",
                        ...null !== (a = null == t ? void 0 : t.headers) && void 0 !== a ? a : {}
                    }
                });
                if ("opaqueredirect" === n.type || 0 === n.status) throw new s(403, "subscription_required");
                let l = (null !== (r = n.headers.get("content-type")) && void 0 !== r ? r : "").includes("application/json") ? await n.json().catch(() => ({})) : {};
                if (!n.ok) {
                    let e = "string" == typeof l.error ? l.error : "http_".concat(n.status);
                    throw new s(n.status, e, l)
                }
                return l
            }

            function n() {
                return r("/api/billing/upgrade", {
                    method: "GET"
                })
            }

            function l(e) {
                return r("/api/billing/upgrade", {
                    method: "POST",
                    body: JSON.stringify(e ? {
                        interval: e
                    } : {})
                })
            }

            function i() {
                return r("/api/billing/pro-trial", {
                    method: "POST",
                    body: "{}"
                })
            }

            function o() {
                return r("/api/billing/pro-trial/cancel", {
                    method: "POST",
                    body: "{}"
                })
            }

            function d(e) {
                if (!e) return "";
                let t = "string" == typeof e ? new Date(e) : e;
                return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                })
            }
        }
    }
]);