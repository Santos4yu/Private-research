(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4174], {
        62456: function() {},
        58520: function(e, t, s) {
            "use strict";
            s.d(t, {
                w: function() {
                    return I
                },
                default: function() {
                    return V
                }
            });
            var r = s(10131),
                a = s(53824),
                l = s(63210),
                n = s(40122),
                i = s(37824),
                o = s(45996),
                d = s(52058),
                c = s(45640),
                u = s(77463),
                m = s(86128),
                x = s(47288),
                h = s(55185),
                p = s(52901),
                g = s(55212),
                b = s(97848);

            function f(e) {
                let {
                    n: t
                } = e;
                return (0, r.jsx)("span", {
                    className: "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold leading-none text-white",
                    children: t
                })
            }

            function j() {
                let [e, t] = (0, h.useState)(null), s = s => t(e === s ? null : s), r = (0, l.Z)("transition-all", null != e && "opacity-30");
                return {
                    active: e,
                    part: (t, s) => (0, l.Z)("cursor-pointer transition-all", s, e === t && "ring-1 ring-blue-400/70 bg-blue-600/[0.12]", null != e && e !== t && "opacity-30"),
                    tap: e => ({
                        onClick: t => {
                            t.stopPropagation(), s(e)
                        }
                    }),
                    dimmed: r,
                    toggle: s
                }
            }

            function w(e) {
                let {
                    children: t
                } = e;
                return (0, r.jsxs)("div", {
                    className: "relative overflow-hidden rounded-xl border border-input bg-new-bg text-primary",
                    children: [(0, r.jsx)("div", {
                        className: "pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-gray-800 to-new-bg"
                    }), (0, r.jsx)("div", {
                        className: "relative z-10 flex flex-col gap-2 p-2.5",
                        children: t
                    })]
                })
            }

            function v(e) {
                let {
                    className: t,
                    name: s,
                    market: a,
                    matchup: n,
                    time: i,
                    badge: o
                } = e;
                return (0, r.jsxs)("div", {
                    className: (0, l.Z)("flex min-w-0 items-center gap-2.5", t),
                    children: [(0, r.jsx)(g.A, {
                        playerId: "9m8m620nygtqd77",
                        imageUrl: "https://cdn.opticodds.com/player-logos/baseball/1229.png",
                        playerName: s,
                        sport: "mlb",
                        size: 40,
                        className: "border-2 border-slate-600/50"
                    }), (0, r.jsxs)("div", {
                        className: "flex min-w-0 flex-col",
                        children: [(0, r.jsxs)("div", {
                            className: "flex min-w-0 items-center gap-1.5",
                            children: [(0, r.jsx)("span", {
                                className: "truncate text-xs font-semibold",
                                children: s
                            }), (0, r.jsx)(b.C, {
                                sport: "mlb",
                                size: 13
                            }), o]
                        }), (0, r.jsx)("span", {
                            className: "truncate text-[11px] text-muted-foreground",
                            children: a
                        }), (0, r.jsxs)("div", {
                            className: "flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground",
                            children: [(0, r.jsx)("span", {
                                className: "truncate",
                                children: n
                            }), (0, r.jsx)("span", {
                                className: "shrink-0",
                                children: "\xb7"
                            }), (0, r.jsx)("span", {
                                className: "shrink-0 tabular-nums",
                                children: i
                            })]
                        })]
                    })]
                })
            }

            function y(e) {
                let {
                    callouts: t,
                    active: s,
                    onToggle: a
                } = e;
                return (0, r.jsxs)(r.Fragment, {
                    children: [(0, r.jsxs)("p", {
                        className: "flex items-center gap-1.5 text-[10px] text-slate-500",
                        children: [(0, r.jsx)(p.Z, {
                            className: "h-3 w-3 shrink-0"
                        }), "Tap a number or the card to highlight that part."]
                    }), (0, r.jsx)("div", {
                        className: "max-h-[28vh] space-y-1 overflow-y-auto overscroll-contain custom-scrollbar md:max-h-none",
                        children: t.map((e, t) => {
                            let n = t + 1;
                            return (0, r.jsxs)("button", {
                                type: "button",
                                onClick: () => a(n),
                                className: (0, l.Z)("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors", s === n ? "bg-blue-600/[0.12]" : "hover:bg-white/[0.03]"),
                                children: [(0, r.jsx)("span", {
                                    className: "mt-0.5",
                                    children: (0, r.jsx)(f, {
                                        n: n
                                    })
                                }), (0, r.jsxs)("span", {
                                    className: "min-w-0",
                                    children: [(0, r.jsx)("span", {
                                        className: "block text-xs font-medium text-primary",
                                        children: e.label
                                    }), (0, r.jsxs)("span", {
                                        className: "block text-[11px] leading-relaxed",
                                        children: [e.what, " ", (0, r.jsx)("span", {
                                            className: "text-slate-300",
                                            children: e.why
                                        })]
                                    })]
                                })]
                            }, e.label)
                        })
                    })]
                })
            }
            let N = [{
                    label: "EV %",
                    what: "Expected profit per dollar. +6.13% means $100 bet is worth about $106 over time.",
                    why: "Check Width and Vig before trusting a big number."
                }, {
                    label: "Bet at",
                    what: "The book and price to take. Tap the card to open it.",
                    why: "The only book you bet at."
                }, {
                    label: "Fair value",
                    what: "What the bet should pay with the sharp book’s fee removed. Pinnacle’s +103 / -123 makes the Over worth +112 (47% to win).",
                    why: "DraftKings pays +125. That gap is the edge."
                }, {
                    label: "Kelly",
                    what: "How much to bet from your bankroll. Full Kelly is 4.9%; quarter Kelly is $12.26 of $1,000.",
                    why: "Longer odds get a smaller stake at the same EV."
                }, {
                    label: "Width",
                    what: "Gap between the sharp book’s two prices. -110 / -110 is 20.",
                    why: "Tighter is more trustworthy. Under 30 is good for props."
                }, {
                    label: "Vig",
                    what: "The sharp book’s fee as a percent. Under 5% is sharp.",
                    why: "Over 8% and a small edge may not be real."
                }],
                k = [{
                    label: "Profit / ROI",
                    what: "What you keep no matter how it lands. ROI is that profit per dollar staked.",
                    why: "Set your total stake at the top; every card resizes to it."
                }, {
                    label: "Two sides, two books",
                    what: "The Over at one book and the Under at another. Their prices disagree enough that both tickets together pay more than they cost.",
                    why: "You must place both. One alone is a normal bet."
                }, {
                    label: "Bet",
                    what: "How to split your stake. The bigger price gets the smaller bet, so both sides return the same.",
                    why: "If a book caps the bet, the card says so."
                }, {
                    label: "Returns",
                    what: "What each ticket pays if it wins, stake included. Both are above your $500 total.",
                    why: "One of them always wins, so you always finish above $500."
                }],
                C = [{
                    label: "Payout, hit chance, EV",
                    what: "+$444 is the profit if it lands in the gap. 18% is how often the books’ own prices say it will; you only need 6% to break even.",
                    why: "EV combines the two: the average return per dollar over many middles."
                }, {
                    label: "The gap",
                    what: "Over the low line at one book, Under the high line at another. Land on any number in between and both tickets win.",
                    why: "Wider gap, more numbers that hit."
                }, {
                    label: "Bet",
                    what: "How to split your stake across the two books so a miss costs the same either way.",
                    why: "If a book caps the bet, the card says so."
                }, {
                    label: "Lands / Otherwise",
                    what: "The two outcomes in dollars. Miss, and one ticket wins while the other loses, so you lose a little.",
                    why: "A Free tag means the prices overlap and even a miss pays."
                }];
            var F = s(86917),
                S = s(60964),
                Z = s(6672),
                A = s(7357),
                T = s(15),
                O = s(84860),
                _ = s(849),
                E = s(58685),
                B = s(63855),
                L = s(37260);
            let P = new Set(["mlb", "nfl", "nba", "cbb", "cfb", "nhl", "lol", "dota2", "cs2", "val", "cod", "tennis", "soccer", "wnba"]),
                M = (0, h.memo)(function(e) {
                    let {
                        sportKey: t,
                        icon: s,
                        enabled: a,
                        startTimeText: n,
                        selected: i,
                        onSelect: o,
                        iconClassName: d
                    } = e, c = !a && n, u = a || c, m = a || c;
                    return (0, r.jsxs)("button", {
                        type: "button",
                        onClick: u ? () => {
                            if (a) {
                                o(t);
                                return
                            }
                            c && A.Am.info("".concat(t.toUpperCase(), " will be enabled ").concat(n))
                        } : void 0,
                        disabled: !u,
                        className: (0, l.Z)("rounded-xl font-bold px-3 py-1.5 text-xs flex items-center gap-1.5 border", m ? i ? " bg-blue-300/20 border-blue-300/60 text-primary" : "  hover:bg-muted-foreground/20 text-slate-300 border-transparent" : "text-slate-400 cursor-not-allowed bg-gray-600/40 border border-blue-900/60"),
                        children: [P.has(t) ? (0, r.jsx)(O.T, {
                            className: "mr-1",
                            league: t,
                            size: 18,
                            grayscale: !m || !i,
                            noPadding: !0
                        }) : (0, r.jsx)(s, {
                            className: null != d ? d : "w-5 h-5"
                        }), t.toUpperCase()]
                    })
                });

            function I(e) {
                let {
                    title: t,
                    subtitle: s,
                    children: a
                } = e;
                return (0, r.jsx)(B.cZ, {
                    hideClose: !0,
                    className: "border-0 bg-transparent p-0 shadow-none backdrop-blur-none sm:max-w-[440px]",
                    children: (0, r.jsxs)(L.Vd, {
                        className: "shadow-[0_15px_35px_-5px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]",
                        children: [(0, r.jsxs)(L.cb, {
                            className: "justify-between gap-3",
                            children: [(0, r.jsxs)("div", {
                                className: "min-w-0",
                                children: [(0, r.jsx)(B.$N, {
                                    className: "truncate text-sm font-semibold",
                                    children: t
                                }), (0, r.jsx)("p", {
                                    className: "truncate text-xs font-normal text-muted-foreground",
                                    children: s
                                })]
                            }), (0, r.jsxs)(B.GG, {
                                className: "shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus:outline-none",
                                children: [(0, r.jsx)(n.Z, {
                                    className: "h-4 w-4"
                                }), (0, r.jsx)("span", {
                                    className: "sr-only",
                                    children: "Close"
                                })]
                            })]
                        }), (0, r.jsx)(L.NU, {
                            className: "max-h-[80vh] space-y-3 px-5 py-4 text-sm leading-relaxed text-muted-foreground",
                            children: a
                        })]
                    })
                })
            }
            let z = {
                arbitrage: {
                    title: "Arbitrage",
                    subtitle: "How to read a card",
                    content: (0, r.jsx)(function() {
                        let {
                            active: e,
                            part: t,
                            tap: s,
                            dimmed: a,
                            toggle: n
                        } = j(), i = "ring-1 ring-blue-400/70 bg-blue-600/[0.12]", o = (0, l.Z)("flex cursor-pointer flex-col gap-1.5 rounded-lg border border-input bg-highlight/30 p-2 transition-all", 2 === e && i, 1 === e && "opacity-30"), d = t => (0, l.Z)("flex cursor-pointer items-baseline justify-between gap-1 rounded px-0.5 transition-all", e === t && i, null != e && e !== t && e >= 3 && "opacity-30"), c = (e, t, a, l, n, i) => (0, r.jsxs)("div", { ...s(2),
                            className: o,
                            children: [(0, r.jsxs)("span", {
                                className: "flex items-center gap-1 truncate text-[11px] font-medium",
                                children: [null != e && (0, r.jsx)(f, {
                                    n: e
                                }), t]
                            }), (0, r.jsxs)("div", {
                                className: "flex items-center justify-between gap-1",
                                children: [(0, r.jsx)(x.Z, {
                                    appName: a,
                                    size: 22
                                }), (0, r.jsx)("span", {
                                    className: "text-sm font-bold tabular-nums text-green-400",
                                    children: l
                                })]
                            }), (0, r.jsxs)("div", {
                                className: "flex flex-col gap-0.5 border-t border-white/5 pt-1",
                                children: [(0, r.jsxs)("div", { ...s(3),
                                    className: d(3),
                                    children: [(0, r.jsxs)("span", {
                                        className: "flex items-center gap-1 text-[10px] text-muted-foreground",
                                        children: [null != e && (0, r.jsx)(f, {
                                            n: 3
                                        }), "Bet"]
                                    }), (0, r.jsx)("span", {
                                        className: "text-xs font-bold tabular-nums",
                                        children: n
                                    })]
                                }), (0, r.jsxs)("div", { ...s(4),
                                    className: d(4),
                                    children: [(0, r.jsxs)("span", {
                                        className: "flex items-center gap-1 text-[10px] text-muted-foreground",
                                        children: [null != e && (0, r.jsx)(f, {
                                            n: 4
                                        }), "Returns"]
                                    }), (0, r.jsx)("span", {
                                        className: "text-[11px] font-semibold tabular-nums text-green-400",
                                        children: i
                                    })]
                                })]
                            })]
                        });
                        return (0, r.jsxs)(r.Fragment, {
                            children: [(0, r.jsxs)("p", {
                                className: "text-xs",
                                children: ["Two books disagree enough that you can bet ", (0, r.jsx)("span", {
                                    className: "font-medium text-primary",
                                    children: "both sides"
                                }), " and profit whichever way it lands. Tap a card for the exact amounts."]
                            }), (0, r.jsxs)(w, {
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-start justify-between gap-2",
                                    children: [(0, r.jsx)(v, {
                                        className: a,
                                        name: "Shohei Ohtani",
                                        market: "1.5 Total Bases",
                                        matchup: "LAD @ SF",
                                        time: "Fri 9:45PM"
                                    }), (0, r.jsxs)("div", { ...s(1),
                                        className: t(1, "flex shrink-0 flex-col items-end rounded-lg px-1.5 py-0.5 leading-tight"),
                                        children: [(0, r.jsx)("span", {
                                            className: "text-base font-bold tabular-nums text-emerald-400",
                                            children: "+$22.50"
                                        }), (0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground",
                                            children: [(0, r.jsx)(f, {
                                                n: 1
                                            }), "4.50% ROI"]
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-1.5",
                                    children: [c(2, "Over 1.5", "draftkings", "+143", "$215.00", "$522.45"), c(null, "Under 1.5", "fanduel", "-120", "$285.00", "$522.50")]
                                })]
                            }), (0, r.jsx)(y, {
                                callouts: k,
                                active: e,
                                onToggle: n
                            })]
                        })
                    }, {})
                },
                middles: {
                    title: "Middles",
                    subtitle: "How to read a card",
                    content: (0, r.jsx)(function() {
                        let {
                            active: e,
                            part: t,
                            tap: s,
                            dimmed: a,
                            toggle: l
                        } = j(), n = (e, a, l, n, i) => (0, r.jsxs)("div", { ...s(3),
                            className: t(3, "flex flex-col gap-1.5 rounded-lg border border-input bg-highlight/30 p-2"),
                            children: [(0, r.jsx)("span", {
                                className: "truncate text-[11px] font-medium",
                                children: a
                            }), (0, r.jsxs)("div", {
                                className: "flex items-center justify-between gap-1",
                                children: [(0, r.jsx)(x.Z, {
                                    appName: l,
                                    size: 22
                                }), (0, r.jsx)("span", {
                                    className: "text-sm font-bold tabular-nums text-green-400",
                                    children: n
                                })]
                            }), (0, r.jsxs)("div", {
                                className: "flex items-baseline justify-between gap-1 border-t border-white/5 px-0.5 pt-1",
                                children: [(0, r.jsxs)("span", {
                                    className: "flex items-center gap-1 text-[10px] text-muted-foreground",
                                    children: [null != e && (0, r.jsx)(f, {
                                        n: e
                                    }), "Bet"]
                                }), (0, r.jsx)("span", {
                                    className: "text-xs font-bold tabular-nums",
                                    children: i
                                })]
                            })]
                        });
                        return (0, r.jsxs)(r.Fragment, {
                            children: [(0, r.jsxs)("p", {
                                className: "text-xs",
                                children: ["One book has a ", (0, r.jsx)("span", {
                                    className: "font-medium text-primary",
                                    children: "low line"
                                }), ", another a", " ", (0, r.jsx)("span", {
                                    className: "font-medium text-primary",
                                    children: "high line"
                                }), ". Bet Over the low and Under the high; land in between and both win."]
                            }), (0, r.jsxs)(w, {
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-start justify-between gap-2",
                                    children: [(0, r.jsx)(v, {
                                        className: a,
                                        name: "Shohei Ohtani",
                                        market: "Strikeouts",
                                        matchup: "LAD @ SF",
                                        time: "Fri 9:45PM"
                                    }), (0, r.jsxs)("div", { ...s(1),
                                        className: t(1, "flex shrink-0 flex-col items-end rounded-lg px-1.5 py-0.5 leading-tight"),
                                        children: [(0, r.jsx)("span", {
                                            className: "text-base font-bold tabular-nums text-emerald-400",
                                            children: "+$444"
                                        }), (0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground",
                                            children: [(0, r.jsx)(f, {
                                                n: 1
                                            }), (0, r.jsx)("span", {
                                                className: "text-slate-300",
                                                children: "18%"
                                            }), " to hit \xb7 need 6%"]
                                        }), (0, r.jsx)("span", {
                                            className: "text-[10px] font-semibold tabular-nums text-emerald-300",
                                            children: "EV +11.5%"
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", { ...s(2),
                                    className: t(2, "flex items-stretch gap-2 rounded-lg"),
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-input bg-highlight/30 py-1",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-[9px] uppercase tracking-wide text-muted-foreground",
                                            children: "Over"
                                        }), (0, r.jsx)("span", {
                                            className: "text-xs font-bold tabular-nums",
                                            children: "4.5"
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "relative flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1.5",
                                        children: [(0, r.jsxs)("span", {
                                            className: "absolute left-2 top-0.5 flex items-center gap-1 text-[8px] uppercase tracking-wide text-emerald-300/70",
                                            children: [(0, r.jsx)(f, {
                                                n: 2
                                            }), "Both win"]
                                        }), [5, 6].map(e => (0, r.jsx)("span", {
                                            className: "grid h-5 min-w-5 place-items-center rounded bg-emerald-400/20 px-1 text-[11px] font-bold tabular-nums text-emerald-200",
                                            children: e
                                        }, e))]
                                    }), (0, r.jsxs)("div", {
                                        className: "flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-input bg-highlight/30 py-1",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-[9px] uppercase tracking-wide text-muted-foreground",
                                            children: "Under"
                                        }), (0, r.jsx)("span", {
                                            className: "text-xs font-bold tabular-nums",
                                            children: "6.5"
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-1.5",
                                    children: [n(3, "Over 4.5", "draftkings", "-115", "$253.00"), n(null, "Under 6.5", "fanduel", "-110", "$247.00")]
                                }), (0, r.jsxs)("div", { ...s(4),
                                    className: t(4, "grid grid-cols-2 gap-1.5 rounded-lg"),
                                    children: [(0, r.jsxs)("div", {
                                        className: "flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-1",
                                        children: [(0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] text-emerald-300/80",
                                            children: [(0, r.jsx)(f, {
                                                n: 4
                                            }), "Lands 5 or 6"]
                                        }), (0, r.jsx)("span", {
                                            className: "text-[11px] font-bold tabular-nums text-emerald-300",
                                            children: "+$444"
                                        })]
                                    }), (0, r.jsxs)("div", {
                                        className: "flex items-center justify-between rounded-lg border border-input bg-highlight/30 px-2 py-1",
                                        children: [(0, r.jsx)("span", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: "Otherwise"
                                        }), (0, r.jsx)("span", {
                                            className: "text-[11px] font-bold tabular-nums text-slate-300",
                                            children: "-$28"
                                        })]
                                    })]
                                })]
                            }), (0, r.jsx)(y, {
                                callouts: C,
                                active: e,
                                onToggle: l
                            })]
                        })
                    }, {})
                },
                ev: {
                    title: "EV+",
                    subtitle: "How to read a card",
                    content: (0, r.jsx)(function() {
                        let {
                            active: e,
                            part: t,
                            tap: s,
                            dimmed: a,
                            toggle: n
                        } = j(), i = (e, a, n, i) => (0, r.jsxs)("div", { ...s(e),
                            className: t(e, (0, l.Z)("flex flex-1 items-center justify-between gap-1 rounded-lg border px-2 py-1", i ? "border-emerald-400/20 bg-emerald-400/[0.06]" : "border-input bg-highlight/30")),
                            children: [(0, r.jsxs)("span", {
                                className: (0, l.Z)("flex items-center gap-1 text-[10px]", i ? "text-emerald-300/80" : "text-muted-foreground"),
                                children: [(0, r.jsx)(f, {
                                    n: e
                                }), a, (0, r.jsx)(u.Z, {
                                    className: "hidden h-2.5 w-2.5 opacity-60 md:block"
                                })]
                            }), (0, r.jsx)("span", {
                                className: (0, l.Z)("text-[11px] font-bold tabular-nums", i ? "text-emerald-300" : "text-slate-200"),
                                children: n
                            })]
                        });
                        return (0, r.jsxs)(r.Fragment, {
                            children: [(0, r.jsxs)("p", {
                                className: "text-xs",
                                children: ["We strip a sharp book's fee to find the ", (0, r.jsx)("span", {
                                    className: "font-medium text-primary",
                                    children: "fair price"
                                }), ", then flag any book paying more than that. One bet can lose; the edge shows up over many."]
                            }), (0, r.jsxs)(w, {
                                children: [(0, r.jsxs)("div", {
                                    className: "flex items-start justify-between gap-2",
                                    children: [(0, r.jsx)(v, {
                                        className: a,
                                        name: "Shohei Ohtani",
                                        market: "Over 1.5 Total Bases",
                                        matchup: "LAD @ SF",
                                        time: "Fri 9:45PM"
                                    }), (0, r.jsxs)("div", { ...s(1),
                                        className: t(1, "flex shrink-0 flex-col items-end rounded-lg px-1.5 py-0.5 leading-tight"),
                                        children: [(0, r.jsx)("span", {
                                            className: "text-base font-bold tabular-nums text-emerald-400",
                                            children: "+6.13%"
                                        }), (0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] text-muted-foreground",
                                            children: [(0, r.jsx)(f, {
                                                n: 1
                                            }), "EV"]
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-1.5",
                                    children: [(0, r.jsxs)("div", { ...s(2),
                                        className: t(2, "flex flex-col gap-1.5 rounded-lg border border-input bg-highlight/30 p-2"),
                                        children: [(0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground",
                                            children: [(0, r.jsx)(f, {
                                                n: 2
                                            }), "Bet at ", (0, r.jsx)(m.Z, {
                                                className: "h-2.5 w-2.5"
                                            })]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex items-center justify-between gap-1",
                                            children: [(0, r.jsxs)("div", {
                                                className: "flex min-w-0 items-center gap-1.5",
                                                children: [(0, r.jsx)(x.Z, {
                                                    appName: "draftkings",
                                                    size: 22
                                                }), (0, r.jsx)("span", {
                                                    className: "truncate text-[11px] font-medium",
                                                    children: "DraftKings"
                                                })]
                                            }), (0, r.jsx)("span", {
                                                className: "text-sm font-bold tabular-nums text-green-400",
                                                children: "+125"
                                            })]
                                        })]
                                    }), (0, r.jsxs)("div", { ...s(3),
                                        className: t(3, "flex flex-col gap-1.5 rounded-lg border border-input bg-highlight/30 p-2"),
                                        children: [(0, r.jsxs)("span", {
                                            className: "flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground",
                                            children: [(0, r.jsx)(f, {
                                                n: 3
                                            }), "Fair value"]
                                        }), (0, r.jsxs)("div", {
                                            className: "flex items-center justify-between gap-1",
                                            children: [(0, r.jsxs)("div", {
                                                className: "flex min-w-0 items-center gap-1.5",
                                                children: [(0, r.jsx)(x.Z, {
                                                    appName: "pinnacle",
                                                    size: 22
                                                }), (0, r.jsx)("span", {
                                                    className: "truncate text-[11px] font-medium",
                                                    children: "Pinnacle"
                                                })]
                                            }), (0, r.jsx)("span", {
                                                className: "text-sm font-bold tabular-nums",
                                                children: "+112"
                                            })]
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "flex gap-1.5",
                                    children: [i(4, "Kelly 0.25x", "$12.26", !0), i(5, "Width", "20"), i(6, "Vig", "4%")]
                                })]
                            }), (0, r.jsx)(y, {
                                callouts: N,
                                active: e,
                                onToggle: n
                            })]
                        })
                    }, {})
                },
                discrepancies: {
                    title: "Line differences",
                    subtitle: "When books post different numbers on the same prop",
                    content: (0, r.jsxs)(r.Fragment, {
                        children: [(0, r.jsx)("p", {
                            children: "Sportsbooks don't always set the same line for the same player. We line them up side by side and show you where they disagree the most."
                        }), (0, r.jsx)("p", {
                            children: "A lower line is easier to hit on the Over, and a higher line is easier to hit on the Under. So the book that's out of step with the rest is usually the best place to take your side."
                        }), (0, r.jsx)("div", {
                            className: "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs",
                            children: (0, r.jsxs)("p", {
                                children: ["Example: one book has a player's points at ", (0, r.jsx)("span", {
                                    className: "font-semibold text-primary",
                                    children: "15"
                                }), " ", "and another has it at ", (0, r.jsx)("span", {
                                    className: "font-semibold text-primary",
                                    children: "20"
                                }), ". Bet the Over at 15 or the Under at 20, whichever fits your pick."]
                            })
                        })]
                    })
                },
                popular: {
                    title: "Popular",
                    subtitle: "The props people are saving the most",
                    content: (0, r.jsxs)(r.Fragment, {
                        children: [(0, r.jsx)("p", {
                            children: "Every time someone saves a pick, it moves up this list. The ones at the top are what bettors are backing right now."
                        }), (0, r.jsxs)("div", {
                            className: "flex gap-3",
                            children: [(0, r.jsx)(i.Z, {
                                className: "mt-0.5 h-4 w-4 shrink-0 text-blue-200"
                            }), (0, r.jsx)("p", {
                                children: "Popular does not mean it's a smart bet. It only means a lot of people saved it, so always look at the matchup yourself."
                            })]
                        }), (0, r.jsxs)("div", {
                            className: "flex gap-3",
                            children: [(0, r.jsx)(o.Z, {
                                className: "mt-0.5 h-4 w-4 shrink-0 text-blue-200"
                            }), (0, r.jsx)("p", {
                                children: "Tap any pick to see the player's recent stats and matchup before you decide."
                            })]
                        })]
                    })
                }
            };

            function D(e) {
                let {
                    sortedSports: t,
                    selectedSports: s,
                    isAll: a,
                    onChange: l,
                    trigger: n,
                    triggerClassName: i,
                    triggerChevronClassName: o,
                    triggerActive: d
                } = e, c = (0, h.useMemo)(() => t.filter(e => {
                    let [, t] = e;
                    return t.enabled
                }).map(e => {
                    let [t] = e;
                    return t
                }), [t]), u = (0, h.useMemo)(() => t.filter(e => {
                    let [, t] = e;
                    return t.enabled
                }).map(e => {
                    let [t, s] = e;
                    return {
                        label: t.toUpperCase(),
                        value: t,
                        icon: P.has(t) ? (0, r.jsx)(O.T, {
                            league: t,
                            size: 18,
                            grayscale: !1,
                            noPadding: !0
                        }) : s.icon
                    }
                }), [t]), [m, x] = (0, h.useState)(!1), p = (0, h.useMemo)(() => m ? [] : a ? c : s.filter(e => c.includes(e)), [c, a, s, m]), g = (0, h.useCallback)(e => {
                    x(0 === e.length), l(e)
                }, [l]);
                return (0, r.jsx)(_.N, {
                    enableOnlyAction: !0,
                    options: u,
                    selectedValues: p,
                    onValueChange: g,
                    onOpenChange: e => {
                        e || x(!1)
                    },
                    allValues: c,
                    iconClassName: "items-center !space-x-1.5",
                    placeholder: "Sports",
                    searchPlaceholder: "Search sports...",
                    variant: "secondary",
                    showTriggerClear: !1,
                    triggerActive: d,
                    customDisplayLabel: n,
                    emptyDisplayLabel: n,
                    triggerChevronClassName: null != o ? o : "ml-1 mr-0 h-3.5 w-3.5",
                    popoverContentClassName: "z-[200] bg-card-bg",
                    className: (0, E.cn)("h-auto min-h-0 w-auto rounded-xl pl-3 pr-2 py-1.5 text-xs font-bold gap-0 shadow-none", i)
                })
            }

            function V(e) {
                let {
                    title: t,
                    hideSports: s,
                    help: n,
                    subtitle: i
                } = e, o = (0, F.V)(), u = (0, h.useRef)(null), m = (0, h.useRef)(null), [x, p] = (0, h.useState)(!1), [g, b] = (0, h.useState)(!1), {
                    selectedSports: f,
                    isAll: j,
                    setSelectedSports: w,
                    selectOnly: v
                } = (0, T.w)(), y = (0, h.useRef)(!1), N = f[0], k = N ? o[N] : void 0;
                (0, h.useEffect)(() => {
                    let e = u.current;
                    if (!e) return;
                    let t = () => {
                        if (e) {
                            let {
                                scrollLeft: t,
                                scrollWidth: s,
                                clientWidth: r
                            } = e;
                            p(t > 0), b(t < s - r - 1)
                        }
                    };
                    e.addEventListener("scroll", t), window.addEventListener("resize", t);
                    let s = setTimeout(t, 100);
                    return () => {
                        e && e.removeEventListener("scroll", t), clearTimeout(s), window.removeEventListener("resize", t)
                    }
                }, []);
                let [C, A] = (0, h.useState)(!1);
                (0, h.useEffect)(() => {
                    A(!0)
                }, []), (0, h.useEffect)(() => {
                    if (!C) return;
                    let e = f.filter(e => {
                        var t;
                        return null === (t = o[e]) || void 0 === t ? void 0 : t.enabled
                    });
                    e.length !== f.length && w(e)
                }, [C, f, o, w]);
                let _ = (0, h.useRef)(void 0);
                (0, h.useEffect)(() => {
                    let e = y.current;
                    y.current = !1;
                    let t = _.current !== N;
                    _.current = N, !e && t && 1 === f.length && m.current && m.current.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center"
                    })
                }, [f, N]);
                let E = e => {
                        u.current && u.current.scrollBy({
                            left: "left" === e ? -200 : 200,
                            behavior: "smooth"
                        })
                    },
                    L = e => e.enabled || !!e.startTimeText,
                    V = (0, h.useMemo)(() => Object.entries(o).sort((e, t) => {
                        let s = L(e[1]),
                            r = L(t[1]);
                        return s && !r ? -1 : !s && r ? 1 : 0
                    }), [o]),
                    U = V.filter(e => {
                        let [, t] = e;
                        return t.enabled
                    }).length,
                    Y = (0, h.useCallback)(e => {
                        v(e)
                    }, [v]),
                    R = (0, h.useCallback)(e => {
                        let t = 0 === e.length || e.length >= U;
                        y.current = !0, w(t ? [] : e)
                    }, [U, !1, w]);
                return (0, r.jsxs)("div", {
                    className: "flex flex-col",
                    children: [(0, r.jsxs)("div", {
                        className: "relative flex w-full justify-between items-center h-12 px-4 pt-4 pb-1 md:pb-2 lg:rounded-tl-3xl",
                        children: [(0, r.jsxs)("div", {
                            className: "flex gap-2 items-center shrink-0",
                            children: [(0, r.jsx)(Z.vP, {
                                className: "shrink-0 h-6 w-6 md:h-7 md:w-7 -mr-0.5 md:mr-0 [&_svg]:h-[18px] [&_svg]:w-[18px] md:[&_svg]:h-5 md:[&_svg]:w-5"
                            }), (0, r.jsx)("h1", {
                                className: "font-semibold text-[16px] md:text-lg text-slate-100 leading-none whitespace-nowrap",
                                children: t
                            }), n && (0, r.jsxs)(B.Vq, {
                                children: [(0, r.jsx)(B.hg, {
                                    "aria-label": "Help",
                                    className: "ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-blue-300/60 bg-blue-300/20 text-xs font-bold leading-none text-primary transition-colors hover:bg-blue-300/30",
                                    children: "?"
                                }), (0, r.jsx)(I, {
                                    title: z[n].title,
                                    subtitle: z[n].subtitle,
                                    children: z[n].content
                                })]
                            }), !s && (0, r.jsx)("svg", {
                                width: "16",
                                height: "16",
                                viewBox: "0 0 16 16",
                                fill: "none",
                                className: "flex-shrink-0 mx-0.5 sm:mx-2.5",
                                xmlns: "http://www.w3.org/2000/svg",
                                "aria-hidden": "true",
                                children: (0, r.jsx)("path", {
                                    d: "M10 2L6 14",
                                    stroke: "#B7B8C2",
                                    strokeWidth: "1.5",
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round"
                                })
                            }), !s && (0, r.jsx)("div", {
                                className: "md:hidden shrink-0",
                                children: (0, r.jsx)(D, {
                                    sortedSports: V,
                                    selectedSports: f,
                                    isAll: j,
                                    onChange: R,
                                    triggerActive: !0,
                                    triggerClassName: "border-blue-300/60 bg-blue-300/20 pl-3 pr-2.5 text-primary hover:bg-blue-300/30",
                                    trigger: (0, r.jsxs)("span", {
                                        className: "flex items-center gap-1.5",
                                        children: [1 === f.length && N ? P.has(N) ? (0, r.jsx)(O.T, {
                                            league: N,
                                            size: 18,
                                            grayscale: !1,
                                            noPadding: !0
                                        }) : k && (0, r.jsx)(k.icon, {
                                            className: "w-5 h-5"
                                        }) : j ? (0, r.jsx)(S.YIN, {
                                            className: "w-5 h-5 p-0.5 !stroke-white"
                                        }) : null, j ? "ALL" : 1 === f.length ? null == N ? void 0 : N.toUpperCase() : "".concat(f.length, " SPORTS")]
                                    })
                                })
                            })]
                        }), !s && (0, r.jsxs)("div", {
                            className: "hidden md:flex items-center relative overflow-hidden mr-auto",
                            children: [x && (0, r.jsx)("button", {
                                onClick: () => E("left"),
                                className: "absolute left-0 z-10 bg-gray-800 p-1 rounded-full shadow-md text-muted-foreground",
                                children: (0, r.jsx)(d.Z, {
                                    className: "w-5 h-5"
                                })
                            }), (0, r.jsxs)("div", {
                                ref: u,
                                className: (0, l.Z)("flex overflow-x-scroll items-center relative gap-2.5 scrollbar-none"),
                                style: {
                                    maskImage: "linear-gradient(to right, ".concat(x ? "transparent, black 20%" : "black 0%", ", black 80%, ").concat(g ? "transparent 100%" : "black 100%", ")"),
                                    WebkitMaskImage: "linear-gradient(to right, ".concat(x ? "transparent, black 20%" : "black 0%", ", black 80%, ").concat(g ? "transparent 100%" : "black 100%", ")")
                                },
                                children: [(0, r.jsx)("div", {
                                    ref: j ? m : void 0,
                                    children: (0, r.jsx)(D, {
                                        sortedSports: V,
                                        selectedSports: f,
                                        isAll: j,
                                        onChange: R,
                                        triggerActive: j,
                                        triggerClassName: j ? "border-blue-300/60 bg-blue-300/20 text-primary hover:bg-blue-300/20" : "border-transparent bg-transparent text-slate-300 hover:bg-muted-foreground/20",
                                        trigger: (0, r.jsxs)("span", {
                                            className: "flex items-center gap-1.5",
                                            children: [(0, r.jsx)(S.YIN, {
                                                className: "w-5 h-5"
                                            }), "ALL"]
                                        })
                                    })
                                }), V.map(e => {
                                    var t;
                                    let s = e[1].icon,
                                        a = e[0].toLowerCase();
                                    return (0, r.jsx)("div", {
                                        ref: N === a ? m : void 0,
                                        children: (0, r.jsx)(M, {
                                            sportKey: a,
                                            icon: s,
                                            enabled: null !== (t = e[1].enabled) && void 0 !== t && t,
                                            startTimeText: e[1].startTimeText,
                                            selected: f.includes(a),
                                            onSelect: Y
                                        })
                                    }, a)
                                })]
                            }), g && (0, r.jsx)("button", {
                                onClick: () => E("right"),
                                className: "absolute right-0 z-10 bg-gray-800 p-1 rounded-full shadow-md text-muted-foreground",
                                children: (0, r.jsx)(c.Z, {
                                    className: "w-5 h-5"
                                })
                            })]
                        }), (0, r.jsx)("div", {
                            className: "flex items-center gap-2 ml-2 shrink-0",
                            children: (0, r.jsx)(a.Z, {
                                showUserButton: !0
                            })
                        })]
                    }), i && (0, r.jsx)("p", {
                        className: "text-sm z-50 text-muted-foreground px-5 mt-0.5",
                        children: i
                    })]
                })
            }
        },
        53824: function(e, t, s) {
            "use strict";
            s.d(t, {
                Z: function() {
                    return D
                }
            });
            var r = s(10131),
                a = s(41915),
                l = s(63210),
                n = s(55185),
                i = s(69687),
                o = s(69237),
                d = s(47898),
                c = s(88045),
                u = s(98533),
                m = s.n(u),
                x = s(87743),
                h = s(54032),
                p = s(50761),
                g = s(47068),
                b = s(62370),
                f = s(3300),
                j = s(85922),
                w = s(5460),
                v = s(51465);
            let y = {
                    "Bug Fixes": {
                        icon: (0, r.jsx)(h.Z, {
                            className: "w-3 h-3"
                        }),
                        pill: "border border-red-500/40 bg-red-500/10 text-red-400",
                        dot: "bg-red-500",
                        glow: "via-red-500/20"
                    },
                    "New Features": {
                        icon: (0, r.jsx)(p.Z, {
                            className: "w-3 h-3"
                        }),
                        pill: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                        dot: "bg-emerald-500",
                        glow: "via-emerald-500/20"
                    },
                    Improvements: {
                        icon: (0, r.jsx)(g.Z, {
                            className: "w-3 h-3"
                        }),
                        pill: "border border-[#3461FF]/50 bg-[#3461FF]/10 text-blue-400",
                        dot: "bg-[#3461FF]",
                        glow: "via-[#3461FF]/20"
                    },
                    Other: {
                        icon: (0, r.jsx)(b.Z, {
                            className: "w-3 h-3"
                        }),
                        pill: "border border-white/10 bg-white/[0.04] text-[#6F7280]",
                        dot: "bg-[#6F7280]",
                        glow: "via-white/10"
                    }
                },
                N = e => {
                    var t;
                    return null !== (t = y[e]) && void 0 !== t ? t : y.Other
                };

            function k() {
                let [e, t] = (0, x._)("lastUpdate", ""), {
                    data: s
                } = (0, d.Z)("/api/updates", c.Z), a = s && s.some(t => t.date > e);
                return (0, r.jsxs)(v.J2, {
                    onOpenChange: e => {
                        e && (null == s ? void 0 : s.length) && t(s[0].date)
                    },
                    children: [(0, r.jsx)(v.xo, {
                        asChild: !0,
                        children: (0, r.jsxs)("button", {
                            className: "relative flex items-center justify-center w-6 h-6 group",
                            children: [(0, r.jsx)(f.Z, {
                                className: "w-5 h-5 text-[#AFB2C0] group-hover:text-white transition-colors duration-200"
                            }), (0, r.jsx)(j.M, {
                                children: a && (0, r.jsxs)(w.E.span, {
                                    initial: {
                                        scale: 0,
                                        opacity: 0
                                    },
                                    animate: {
                                        scale: 1,
                                        opacity: 1
                                    },
                                    exit: {
                                        scale: 0,
                                        opacity: 0
                                    },
                                    transition: {
                                        duration: .25,
                                        ease: [.34, 1.56, .64, 1]
                                    },
                                    className: "absolute top-0 right-0 flex",
                                    children: [(0, r.jsx)("span", {
                                        className: "absolute w-2 h-2 bg-sky-400 rounded-full animate-ping"
                                    }), (0, r.jsx)("span", {
                                        className: "w-2 h-2 bg-sky-500 rounded-full"
                                    })]
                                })
                            })]
                        })
                    }), (0, r.jsxs)(v.yk, {
                        collisionPadding: {
                            top: 0,
                            right: 10,
                            bottom: 0,
                            left: 0
                        },
                        className: "p-0 !w-96 rounded-2xl border border-white/[0.06] bg-card-bg backdrop-blur-xl shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden",
                        children: [(0, r.jsx)("div", {
                            className: "absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-px bg-gradient-to-r from-transparent via-[#3461FF]/60 to-transparent pointer-events-none"
                        }), (0, r.jsxs)("div", {
                            className: "px-4 pt-4 pb-3 border-b border-white/[0.06]",
                            children: [(0, r.jsxs)("div", {
                                className: "flex items-center justify-between",
                                children: [(0, r.jsx)("h2", {
                                    className: "text-sm font-semibold text-white tracking-tight",
                                    children: "Recent Updates"
                                }), s && (0, r.jsxs)("span", {
                                    className: "px-2 py-0.5 rounded-full bg-gradient-to-r from-[#3461FF] to-[#567BFF] text-[10px] font-bold text-white uppercase tracking-wider",
                                    children: [s.length, " updates"]
                                })]
                            }), (0, r.jsx)("p", {
                                className: "text-xs text-[#6F7280] mt-0.5",
                                children: "Leave suggestions in our Discord!"
                            })]
                        }), (0, r.jsxs)("ul", {
                            className: "space-y-0 max-h-[420px] overflow-y-auto custom-scrollbar-thin divide-y divide-white/[0.04]",
                            children: [null == s ? void 0 : s.map((t, s) => {
                                let a = N(t.type),
                                    n = t.date > e;
                                return (0, r.jsxs)(w.E.li, {
                                    initial: {
                                        opacity: 0,
                                        y: 6
                                    },
                                    animate: {
                                        opacity: 1,
                                        y: 0
                                    },
                                    transition: {
                                        duration: .3,
                                        delay: .055 * s,
                                        ease: [.25, .46, .45, .94]
                                    },
                                    className: "relative px-4 py-3.5 hover:bg-white/[0.025] transition-colors duration-200 group/item",
                                    children: [(0, r.jsx)("div", {
                                        className: (0, l.Z)("absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity duration-200", a.dot)
                                    }), n && (0, r.jsx)("div", {
                                        className: (0, l.Z)("absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent", a.glow)
                                    }), (0, r.jsxs)("div", {
                                        className: "flex items-start justify-between gap-3",
                                        children: [(0, r.jsxs)("div", {
                                            className: "flex-1 min-w-0",
                                            children: [(0, r.jsxs)("div", {
                                                className: "flex items-center gap-2 mb-1.5",
                                                children: [(0, r.jsx)("p", {
                                                    className: "text-sm font-medium text-white truncate",
                                                    children: t.customTitle || "Update"
                                                }), n && (0, r.jsx)("span", {
                                                    className: "flex-shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-[9px] font-bold text-sky-400 uppercase tracking-wider",
                                                    children: "New"
                                                })]
                                            }), (0, r.jsx)("ul", {
                                                className: "space-y-1",
                                                children: t.bulletPoints.map((e, t) => (0, r.jsxs)("li", {
                                                    className: "flex items-start gap-2",
                                                    children: [(0, r.jsx)("div", {
                                                        className: "flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/10 flex-shrink-0 mt-0.5",
                                                        children: (0, r.jsx)("div", {
                                                            className: "w-1.5 h-1.5 rounded-full bg-emerald-500/60"
                                                        })
                                                    }), (0, r.jsx)("span", {
                                                        className: "text-xs text-[#AFB2C0] leading-relaxed",
                                                        children: e
                                                    })]
                                                }, t))
                                            }), (0, r.jsx)("p", {
                                                className: "text-[10px] text-[#6F7280]/70 mt-2",
                                                children: m()(t.date).format("MMMM D, YYYY [at] h:mm A")
                                            })]
                                        }), (0, r.jsxs)("span", {
                                            className: (0, l.Z)("flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium", a.pill),
                                            children: [a.icon, (0, r.jsx)("span", {
                                                children: t.type
                                            })]
                                        })]
                                    })]
                                }, t.id)
                            }), !s && (0, r.jsx)("li", {
                                className: "px-4 py-8 text-center",
                                children: (0, r.jsxs)("div", {
                                    className: "flex flex-col items-center gap-2",
                                    children: [(0, r.jsx)("div", {
                                        className: "w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center",
                                        children: (0, r.jsx)(f.Z, {
                                            className: "w-4 h-4 text-[#6F7280]"
                                        })
                                    }), (0, r.jsx)("p", {
                                        className: "text-xs text-[#6F7280]",
                                        children: "Loading updates…"
                                    })]
                                })
                            })]
                        })]
                    })]
                })
            }
            var C = s(29453),
                F = s(57558),
                S = s(91357),
                Z = s(43806),
                A = s(59160),
                T = s(8933),
                O = s(28876),
                _ = s(34772),
                E = s(9379),
                B = s(21994);
            let L = e => {
                    let {
                        className: t
                    } = e;
                    return (0, r.jsx)("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "currentColor",
                        className: t,
                        children: (0, r.jsx)("path", {
                            fill: "currentColor",
                            d: "M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0a13 13 0 0 0-.617-1.25a.08.08 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.1.1 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.08.08 0 0 0 .084-.028a14 14 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13 13 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10 10 0 0 0 .372-.292a.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01q.181.149.373.292a.077.077 0 0 1-.006.127a12.3 12.3 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028a19.8 19.8 0 0 0 6.002-3.03a.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418"
                        })
                    })
                },
                P = e => {
                    let {
                        className: t
                    } = e;
                    return (0, r.jsx)("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 576 512",
                        fill: "currentColor",
                        className: t,
                        children: (0, r.jsx)("path", {
                            fill: "currentColor",
                            d: "M0 432c0 26.5 21.5 48 48 48h480c26.5 0 48-21.5 48-48V256H0v176zm192-68c0-6.6 5.4-12 12-12h136c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H204c-6.6 0-12-5.4-12-12v-40zm-128 0c0-6.6 5.4-12 12-12h72c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zM576 80v48H0V80c0-26.5 21.5-48 48-48h480c26.5 0 48 21.5 48 48z"
                        })
                    })
                },
                M = e => !!(e && "None" !== e),
                I = null;

            function z(e) {
                let {
                    planLabel: t,
                    hasBothBillingSources: s,
                    hasStripeBilling: l,
                    revenueCatId: o,
                    isWebViewApp: d,
                    onManageApple: c
                } = e, [u, m] = (0, n.useState)(null), [x, h] = (0, n.useState)(null);
                return (0, n.useEffect)(() => {
                    if (!l) return;
                    let e = !1;
                    return (function() {
                        let e = Date.now();
                        if (I && e - I.at < 5e3) return I.promise;
                        let t = (async () => {
                            let e = await fetch("/api/billing/create-session", {
                                method: "POST"
                            });
                            if (!e.ok) throw Error((await e.json().catch(() => ({}))).message || "Failed to load the billing portal.");
                            let {
                                url: t
                            } = await e.json();
                            return t
                        })();
                        return t.catch(() => {
                            I = null
                        }), I = {
                            at: e,
                            promise: t
                        }, t
                    })().then(t => {
                        e || m(t)
                    }).catch(t => {
                        console.error("Error loading website billing:", t), e || h(t.message || "Failed to load the billing portal.")
                    }), () => {
                        e = !0
                    }
                }, [l]), (0, r.jsxs)("div", {
                    children: [(0, r.jsx)("h1", {
                        className: "font-bold mb-4",
                        children: "Billing"
                    }), (0, r.jsxs)("div", {
                        className: "border-t border-slate-900 py-4",
                        children: [(0, r.jsxs)("p", {
                            className: "mb-4 text-muted-foreground text-sm",
                            children: ["Plan: ", (0, r.jsx)("span", {
                                className: "font-bold",
                                children: t
                            })]
                        }), s ? (0, r.jsxs)("div", {
                            className: "grid gap-3 sm:grid-cols-2",
                            children: [(0, r.jsxs)("div", {
                                className: "rounded-lg border border-slate-800 bg-slate-950/70 p-4",
                                children: [(0, r.jsx)("h2", {
                                    className: "font-semibold text-primary",
                                    children: "Purchased through Apple?"
                                }), (0, r.jsx)("p", {
                                    className: "mt-1 mb-4 text-sm text-muted-foreground",
                                    children: "Apple billing: manage subscription in App Store."
                                }), (0, r.jsx)(i.z, {
                                    className: "w-full flex items-center gap-2",
                                    variant: "blue",
                                    onClick: c,
                                    children: "Manage Apple Subscription"
                                })]
                            }), (0, r.jsxs)("div", {
                                className: "rounded-lg border border-slate-800 bg-slate-950/70 p-4",
                                children: [(0, r.jsx)("h2", {
                                    className: "font-semibold text-primary",
                                    children: "Purchased through our site?"
                                }), (0, r.jsx)("p", {
                                    className: "mt-1 mb-4 text-sm text-muted-foreground",
                                    children: "Website billing: manage subscription in your browser."
                                }), (0, r.jsx)(i.z, {
                                    className: "w-full flex items-center gap-2",
                                    variant: "blue",
                                    asChild: !0,
                                    children: (0, r.jsx)("a", {
                                        href: null != u ? u : "/billing",
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: "Manage Billing"
                                    })
                                })]
                            })]
                        }) : o && d ? (0, r.jsx)(i.z, {
                            className: "w-full sm:w-1/3 flex items-center gap-2",
                            variant: "blue",
                            onClick: c,
                            children: "Manage Subscription"
                        }) : (0, r.jsx)(i.z, {
                            className: "w-full sm:w-1/3 flex items-center gap-2",
                            variant: "blue",
                            asChild: !0,
                            children: (0, r.jsx)("a", {
                                href: null != u ? u : "/billing",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                children: "Manage Billing"
                            })
                        }), x && (0, r.jsxs)("p", {
                            className: "mt-3 text-sm text-red-400",
                            children: [x, " Try the", " ", (0, r.jsx)(a.default, {
                                className: "font-semibold text-[#9eb2ff]",
                                href: "/billing",
                                target: "_blank",
                                children: "billing page"
                            }), " ", "instead, or email", " ", (0, r.jsx)(a.default, {
                                className: "font-semibold text-[#9eb2ff]",
                                href: "mailto:support@pickfinder.app",
                                children: "support@pickfinder.app"
                            }), "."]
                        })]
                    })]
                })
            }

            function D(e) {
                let {
                    className: t,
                    showUserButton: s = !1
                } = e, [a, i] = (0, n.useState)(!1), [d, c] = (0, n.useState)(!1), [u, m] = (0, n.useState)(!1), {
                    user: x,
                    isSignedIn: h
                } = (0, o.aF)(), {
                    isWebViewApp: p
                } = (0, A.B)();
                (0, n.useEffect)(() => {
                    i(!0)
                }, []);
                let g = x && x.publicMetadata || {},
                    b = g.plan || "Loading...",
                    f = "Admin" === b || g.affiliate || !1,
                    j = "Admin" === b,
                    w = (0, O.nt)(b),
                    v = M(g.revenueCatId),
                    y = M(g.stripeId),
                    N = v && y;
                return (0, r.jsxs)("div", {
                    className: (0, l.Z)("flex gap-2.5 items-center", t),
                    children: [a && (0, r.jsxs)(r.Fragment, {
                        children: [(0, r.jsx)("div", {
                            className: "hidden md:flex",
                            children: (0, r.jsx)(k, {})
                        }), s && (0, r.jsx)("div", {
                            className: "aspect-square flex items-center",
                            children: (0, r.jsx)(B.CH, {
                                children: (0, r.jsxs)(o.l8, {
                                    children: [(0, r.jsxs)(o.l8.MenuItems, {
                                        children: [(0, r.jsx)(o.l8.Action, {
                                            label: "Get Discord Access",
                                            onClick: () => {
                                                if (w) {
                                                    c(!0);
                                                    return
                                                }
                                                _.co.trackDiscordPaywallTriggered({
                                                    source: "discord",
                                                    featureName: "Discord Access",
                                                    ...(0, _.cz)({
                                                        isSignedIn: h,
                                                        plan: b,
                                                        isPwa: p,
                                                        isWebView: p
                                                    })
                                                }), m(!0)
                                            },
                                            labelIcon: (0, r.jsx)(L, {})
                                        }), f && (0, r.jsx)(o.l8.Action, {
                                            label: "Affiliate Dashboard",
                                            onClick: () => window.open("https://affiliates.pickfinder.app/", "_blank", "noopener,noreferrer"),
                                            labelIcon: (0, r.jsx)(C.Z, {
                                                className: "w-4 h-4"
                                            })
                                        }), j && (0, r.jsx)(o.l8.Action, {
                                            label: "Sports & Seasons",
                                            onClick: () => window.location.href = "/admin/sports",
                                            labelIcon: (0, r.jsx)(F.Z, {
                                                className: "w-4 h-4"
                                            })
                                        }), j && (0, r.jsx)(o.l8.Action, {
                                            label: "Unmatched Props",
                                            onClick: () => window.location.href = "/admin/unmatched-props",
                                            labelIcon: (0, r.jsx)(S.Z, {
                                                className: "w-4 h-4"
                                            })
                                        }), j && (0, r.jsx)(o.l8.Action, {
                                            label: "Campaigns",
                                            onClick: () => window.location.href = "/admin/campaigns",
                                            labelIcon: (0, r.jsx)(Z.Z, {
                                                className: "w-4 h-4"
                                            })
                                        }), b && "None" !== b && "Loading..." !== b && (0, r.jsx)(o.l8.Action, {
                                            label: "Manage Billing",
                                            open: "Billing",
                                            labelIcon: (0, r.jsx)(P, {})
                                        })]
                                    }), b && "None" !== b && "Loading..." != b && (0, r.jsx)(o.l8.UserProfilePage, {
                                        label: "Billing",
                                        labelIcon: (0, r.jsx)(P, {}),
                                        url: "/billing",
                                        children: (0, r.jsx)(z, {
                                            planLabel: O.gT ? (0, O.AM)(g) : "Friend" === b ? "Friends & Family" : b.toString(),
                                            hasBothBillingSources: N,
                                            hasStripeBilling: y,
                                            revenueCatId: g.revenueCatId,
                                            isWebViewApp: p,
                                            onManageApple: () => {
                                                if (console.log("User clicked manage subscription Apple button"), x && h) {
                                                    var e, t;
                                                    if (null === (t = window.webkit) || void 0 === t ? void 0 : null === (e = t.messageHandlers) || void 0 === e ? void 0 : e.manageSubscription) {
                                                        console.log("Posting manage subscription message to Apple"), window.webkit.messageHandlers.manageSubscription.postMessage({
                                                            id: x.id
                                                        });
                                                        return
                                                    }
                                                }
                                                window.open("https://apps.apple.com/account/subscriptions", "_blank", "noopener,noreferrer")
                                            }
                                        })
                                    })]
                                })
                            })
                        })]
                    }), (0, r.jsx)(E.f, {
                        open: d,
                        onOpenChange: c
                    }), (0, r.jsx)(T.Ei, {
                        open: u,
                        onOpenChange: m,
                        featureName: "Discord Access",
                        title: "Unlock Discord Access",
                        description: "Upgrade to join the private PickFinder Discord and get the member role on your linked Discord account.",
                        benefits: O.vR.discord,
                        source: "discord"
                    })]
                })
            }
        },
        17941: function(e, t, s) {
            "use strict";
            s.d(t, {
                C: function() {
                    return i
                }
            });
            var r = s(10131);
            s(55185);
            var a = s(60656),
                l = s(58685);
            let n = (0, a.j)("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs transition-colors border-slate-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
                variants: {
                    variant: {
                        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
                        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                        destructive: "border-transparent bg-red-500/20 text-red-300 shadow hover:bg-red-500/30",
                        outline: "text-foreground",
                        success: "border-transparent bg-emerald-500/20 text-emerald-500 shadow hover:bg-emerald-500/30"
                    }
                },
                defaultVariants: {
                    variant: "default"
                }
            });

            function i(e) {
                let {
                    className: t,
                    variant: s,
                    ...a
                } = e;
                return (0, r.jsx)("div", {
                    className: (0, l.cn)(n({
                        variant: s
                    }), t),
                    ...a
                })
            }
        },
        16133: function(e, t, s) {
            "use strict";
            s.d(t, {
                di: function() {
                    return g
                },
                e8: function() {
                    return m
                },
                fu: function() {
                    return h
                },
                mY: function() {
                    return c
                },
                rb: function() {
                    return x
                },
                sZ: function() {
                    return u
                },
                zz: function() {
                    return p
                }
            });
            var r = s(10131),
                a = s(55185),
                l = s(2663),
                n = s(45996),
                i = s(58710),
                o = s(58685);
            s(63855);
            let d = a.createContext("default"),
                c = a.forwardRef((e, t) => {
                    let {
                        className: s,
                        variant: a = "default",
                        ...l
                    } = e;
                    return (0, r.jsx)(d.Provider, {
                        value: a,
                        children: (0, r.jsx)(i.mY, {
                            ref: t,
                            className: (0, o.cn)("legacy" === a ? "flex h-full w-full flex-col overflow-hidden rounded-md bg-card-bg text-foreground" : "flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-card-bg text-foreground shadow-xl shadow-black/25", s),
                            ...l
                        })
                    })
                });
            c.displayName = i.mY.displayName;
            let u = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...c
                } = e, u = "legacy" === a.useContext(d);
                return (0, r.jsxs)("div", {
                    className: (0, o.cn)("flex items-center px-3", u ? "border-b border-input" : "border-b border-white/[0.08] bg-white/[0.04] py-2"),
                    "cmdk-input-wrapper": "",
                    children: [u ? (0, r.jsx)(l._Ve, {
                        className: "mr-2 h-4 w-4 shrink-0 opacity-50"
                    }) : (0, r.jsx)(n.Z, {
                        className: "mr-2 h-4 w-4 shrink-0 text-muted-foreground opacity-80",
                        "aria-hidden": !0
                    }), (0, r.jsx)(i.mY.Input, {
                        ref: t,
                        className: (0, o.cn)("flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", u ? "py-3" : "py-2", s),
                        ...c
                    })]
                })
            });
            u.displayName = i.mY.Input.displayName;
            let m = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...l
                } = e, n = a.useContext(d);
                return (0, r.jsx)(i.mY.List, {
                    ref: t,
                    className: (0, o.cn)("legacy" === n ? "max-h-[300px] overflow-y-auto custom-scrollbar overflow-x-hidden" : "max-h-[min(50vh,320px)] overflow-y-auto overflow-x-hidden py-1.5 custom-scrollbar", s),
                    ...l
                })
            });
            m.displayName = i.mY.List.displayName;
            let x = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...l
                } = e, n = a.useContext(d);
                return (0, r.jsx)(i.mY.Empty, {
                    ref: t,
                    className: (0, o.cn)("legacy" === n ? "py-6 text-center text-sm" : "py-8 text-center text-sm text-muted-foreground", s),
                    ...l
                })
            });
            x.displayName = i.mY.Empty.displayName;
            let h = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...l
                } = e, n = a.useContext(d);
                return (0, r.jsx)(i.mY.Group, {
                    ref: t,
                    className: (0, o.cn)("legacy" === n ? "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground" : "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground", s),
                    ...l
                })
            });
            h.displayName = i.mY.Group.displayName;
            let p = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...l
                } = e, n = a.useContext(d);
                return (0, r.jsx)(i.mY.Separator, {
                    ref: t,
                    className: (0, o.cn)("legacy" === n ? "-mx-1 h-px bg-border" : "-mx-1 my-1 h-px bg-white/[0.08]", s),
                    ...l
                })
            });
            p.displayName = i.mY.Separator.displayName;
            let g = a.forwardRef((e, t) => {
                let {
                    className: s,
                    ...l
                } = e, n = a.useContext(d);
                return (0, r.jsx)(i.mY.Item, {
                    ref: t,
                    className: (0, o.cn)("legacy" === n ? "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 hover:bg-blue-600/30" : ["relative mx-0.5 my-0.5 flex cursor-default select-none items-center rounded-lg px-2 py-2 text-sm text-foreground outline-none", "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50", "aria-selected:bg-white/[0.08] data-[selected=true]:bg-white/[0.08]", "hover:bg-white/[0.06]"], s),
                    ...l
                })
            });
            g.displayName = i.mY.Item.displayName
        },
        849: function(e, t, s) {
            "use strict";
            s.d(t, {
                N: function() {
                    return C
                }
            });
            var r = s(10131),
                a = s(55185),
                l = s(60656),
                n = s(59564),
                i = s(76840),
                o = s(5590),
                d = s(37687),
                c = s(38330),
                u = s(93630),
                m = s(58685),
                x = s(12402),
                h = s(69687),
                p = s(17941),
                g = s(51465),
                b = s(16133),
                f = s(53120),
                j = s(36218),
                w = s(83357),
                v = s(63210);

            function y(e, t, s) {
                var r;
                let a = e => e.toLowerCase().replace(/[’']/g, ""),
                    l = a("".concat(e, " ").concat(null !== (r = null == s ? void 0 : s.join(" ")) && void 0 !== r ? r : ""));
                return a(t).split(/\s+/).filter(Boolean).every(e => l.includes(e)) ? 1 : 0
            }
            let N = (0, l.j)("m-1 transition ease-in-out", {
                variants: {
                    variant: {
                        default: "border-gray-400/10 text-foreground bg-card hover:bg-card/80",
                        secondary: "border-gray-400/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
                        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                        inverted: "inverted",
                        blueOutline: "border-blue-500 text-foreground bg-transparent hover:bg-blue-500/10"
                    }
                },
                defaultVariants: {
                    variant: "default"
                }
            });

            function k(e) {
                let {
                    option: t,
                    isSelected: s,
                    isDisabled: a = !1,
                    onToggle: l,
                    onOnlySelect: d,
                    enableOnlyAction: c = !1
                } = e, {
                    attributes: x,
                    listeners: h,
                    setNodeRef: p,
                    transform: g,
                    transition: f
                } = (0, j.nB)({
                    id: t.value
                }), v = {
                    transform: w.ux.Transform.toString(g),
                    transition: f
                };
                return (0, r.jsxs)(b.di, {
                    keywords: t.searchKeywords,
                    ref: p,
                    style: v,
                    onSelect: () => l(t.value),
                    disabled: a,
                    className: (0, m.cn)("flex items-center py-1.5 px-2 min-w-0 overflow-hidden", a && "opacity-50 cursor-not-allowed hover:bg-transparent"),
                    children: [(0, r.jsx)("div", {
                        className: (0, m.cn)("mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border border-input-border", s ? "bg-gradient-to-r from-[#4040FF] to-blue-900 text-blue-300 border-blue-300/60" : "bg-input-bg hover:bg-gradient-to-r hover:from-[#4040FF]/10 hover:to-blue-900/10", a && "!bg-input-bg/50"),
                        children: s && (0, r.jsx)(n.Z, {
                            className: "h-3.5 w-3.5"
                        })
                    }), (() => {
                        let e = u.M9.has(t.value);
                        return (0, r.jsxs)(r.Fragment, {
                            children: [t.icon && "function" == typeof t.icon ? (0, r.jsx)(t.icon, {
                                className: (0, m.cn)("text-primary w-4 h-4 !fill-primary mr-1.5", a && "opacity-50")
                            }) : t.icon && (0, r.jsx)("span", {
                                className: (0, m.cn)("mr-1.5", e && "opacity-50 grayscale"),
                                children: t.icon
                            }), (0, r.jsx)("span", {
                                className: (0, m.cn)("min-w-0 flex-1", (a || e) && "text-muted-foreground"),
                                children: t.label
                            }), c && !e && (0, r.jsx)("button", {
                                type: "button",
                                className: "ml-4 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300 disabled:pointer-events-none disabled:opacity-40",
                                disabled: a,
                                onClick: e => {
                                    e.preventDefault(), e.stopPropagation(), null == d || d(t.value)
                                },
                                children: "ONLY"
                            }), e && (0, r.jsx)(i.Z, {
                                className: "ml-1 w-3.5 h-3.5 text-yellow-500 shrink-0"
                            })]
                        })
                    })(), (0, r.jsx)("div", {
                        className: "ml-auto flex items-center cursor-grab p-1",
                        ...x,
                        ...h,
                        style: {
                            touchAction: "none"
                        },
                        children: (0, r.jsx)(o.Z, {
                            className: "ml-2 h-4 w-4 text-gray-400"
                        })
                    })]
                }, t.value)
            }
            let C = a.forwardRef((e, t) => {
                var s;
                let {
                    options: l,
                    onValueChange: o,
                    variant: w,
                    selectedValues: C = [],
                    allValues: F = [],
                    defaultValue: S = [],
                    onOptionsReorder: Z,
                    placeholder: A = "Select options",
                    noOptionsMessage: T = "No results found",
                    searchPlaceholder: O = "Search...",
                    dropdownNote: _,
                    animation: E = 0,
                    maxCount: B = 3,
                    hideSelectAll: L = !1,
                    maxSelect: P = -1,
                    modalPopover: M = !1,
                    asChild: I = !1,
                    draggable: z = !1,
                    enableOnlyAction: D = !1,
                    showTriggerClear: V = !0,
                    triggerActive: U = !1,
                    triggerChevronClassName: Y,
                    onOpenChange: R,
                    className: $,
                    customDisplayLabel: W,
                    emptyDisplayLabel: H,
                    iconClassName: K,
                    popoverContentClassName: G,
                    displayOrder: q,
                    ...J
                } = e, [Q, X] = a.useState(!1), [ee, et] = a.useState(!1), [es, er] = a.useState(() => l);
                a.useEffect(() => {
                    er(l)
                }, [l]);
                let ea = (0, f.Dy)((0, f.VT)(f.we), (0, f.VT)(f.Lg), (0, f.VT)(f.LO)),
                    el = a.useCallback(e => {
                        let {
                            active: t,
                            over: s
                        } = e;
                        if (!z || !s || t.id === s.id) return;
                        let r = es.findIndex(e => e.value === t.id),
                            a = es.findIndex(e => e.value === s.id);
                        if (r < 0 || a < 0) return;
                        let l = (0, j.Rp)(es, r, a);
                        er(l), null == Z || Z(l)
                    }, [z, es, Z]),
                    en = e => {
                        if (C.includes(e)) {
                            o(C.filter(t => t !== e));
                            return
                        }
                        if (1 === P) {
                            o([e]);
                            return
                        }
                        P > 0 && C.length >= P || o([...C, e])
                    },
                    ei = a.useCallback(e => {
                        o([e])
                    }, [o]),
                    eo = () => {
                        o([])
                    },
                    ed = e => {
                        X(e), null == R || R(e)
                    },
                    ec = a.useCallback(e => C.includes(e), [C]),
                    eu = () => {
                        o(C.slice(0, B))
                    },
                    [em, ex] = a.useState(!1);
                a.useEffect(() => {
                    ex(!0)
                }, []);
                let eh = !z && es.some(e => null != e.group),
                    ep = a.useMemo(() => {
                        if (!eh) return [];
                        let e = [];
                        for (let t of es) {
                            let s = e[e.length - 1];
                            s && s.group === t.group ? s.options.push(t) : e.push({
                                group: t.group,
                                options: [t]
                            })
                        }
                        return e
                    }, [es, eh]),
                    eg = e => {
                        let t = C.includes(e.value),
                            s = 1 !== P && !t && P > 0 && C.length >= P;
                        return (0, r.jsxs)(b.di, {
                            keywords: e.searchKeywords,
                            onSelect: () => en(e.value),
                            disabled: s,
                            className: (0, m.cn)("cursor-pointer rounded-md hover:bg-blue-600/20 py-2 px-2 min-w-0 overflow-hidden", s && "opacity-50 cursor-not-allowed hover:bg-transparent"),
                            children: [(0, r.jsx)("div", {
                                className: (0, m.cn)("mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border border-input-border", t ? "bg-gradient-to-r from-[#4040FF] to-blue-900 text-blue-300 border-blue-300/60" : "bg-input-bg hover:bg-gradient-to-r hover:from-[#4040FF]/10 hover:to-blue-900/10", s && "!bg-input-bg/50"),
                                children: t && (0, r.jsx)(n.Z, {
                                    className: "h-3.5 w-3.5"
                                })
                            }), (() => {
                                let t = u.M9.has(e.value);
                                return (0, r.jsxs)(r.Fragment, {
                                    children: [e.icon && "function" == typeof e.icon ? (0, r.jsx)(e.icon, {
                                        className: (0, m.cn)("text-primary w-4 h-4 !fill-primary", s && "opacity-50")
                                    }) : e.icon && (0, r.jsx)("span", {
                                        className: (0, m.cn)(t && "opacity-50 grayscale"),
                                        children: e.icon
                                    }), (0, r.jsx)("span", {
                                        className: (0, v.Z)("min-w-0 flex-1", e.icon && "ml-1.5", (s || t) && "text-muted-foreground"),
                                        children: "None" === e.label ? "No Modifier" : e.label
                                    }), D && !t && (0, r.jsx)("button", {
                                        type: "button",
                                        className: "ml-4 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300 disabled:pointer-events-none disabled:opacity-40",
                                        disabled: s,
                                        onClick: t => {
                                            t.preventDefault(), t.stopPropagation(), ei(e.value)
                                        },
                                        children: "ONLY"
                                    }), t && (0, r.jsx)(i.Z, {
                                        className: "ml-1 w-3.5 h-3.5 text-yellow-500 shrink-0"
                                    })]
                                })
                            })()]
                        }, e.value)
                    },
                    eb = null != W || null != H,
                    ef = C.length > 0 ? null != W ? W : H : null != H ? H : (0, r.jsx)("span", {
                        className: "text-xs text-primary mx-3",
                        children: A
                    });
                return (0, r.jsxs)(g.J2, {
                    open: Q,
                    onOpenChange: ed,
                    modal: M,
                    children: [(0, r.jsx)(g.xo, {
                        asChild: !0,
                        children: (0, r.jsx)(h.z, {
                            ref: t,
                            ...J,
                            onClick: () => {
                                ed(!Q)
                            },
                            className: (0, m.cn)("flex flex-grow-0 w-full p-1 rounded-2xl sm:rounded-xl border border-input-border bg-input-bg min-h-9 h-11 items-center justify-between hover:bg-input-border", $),
                            children: eb ? (0, r.jsxs)("div", {
                                className: "flex items-center justify-between w-full mx-auto",
                                children: [(0, r.jsx)("div", {
                                    className: "min-w-0 overflow-hidden flex-1",
                                    children: ef
                                }), (0, r.jsx)(d.Z, {
                                    className: (0, m.cn)("mx-2 h-4 shrink-0 cursor-pointer", U ? "text-white/90" : "text-muted-foreground", Y)
                                })]
                            }) : C.length > 0 && em ? (0, r.jsxs)("div", {
                                className: "flex justify-between items-center w-full",
                                children: [W ? (0, r.jsx)("div", {
                                    className: "flex items-center gap-2 min-w-0 overflow-hidden flex-1",
                                    children: "string" == typeof W ? (0, r.jsxs)(p.C, {
                                        className: (0, m.cn)("py-1 hover:bg-highlight rounded-full", ee ? "animate-bounce" : "", N({
                                            variant: w
                                        })),
                                        style: {
                                            animationDuration: "".concat(E, "s")
                                        },
                                        children: [W, (0, r.jsx)("span", {
                                            className: "hidden sm:block ml-1",
                                            children: "Selected"
                                        }), V && (0, r.jsx)(c.Z, {
                                            className: "ml-2 h-5 w-3.5 text-gray-400 cursor-pointer",
                                            onClick: e => {
                                                e.stopPropagation(), eo()
                                            }
                                        })]
                                    }) : (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)("div", {
                                            className: "min-w-0 overflow-x-auto overflow-y-hidden flex-1",
                                            children: W
                                        }), V && (0, r.jsx)(c.Z, {
                                            className: "ml-1 h-4 w-4 shrink-0 text-muted-foreground cursor-pointer hover:text-slate-300",
                                            onClick: e => {
                                                e.stopPropagation(), eo()
                                            }
                                        })]
                                    })
                                }) : (null === (s = l[0]) || void 0 === s ? void 0 : s.icon) ? (0, r.jsxs)("div", {
                                    className: "flex w-full justify-between gap-2 overflow-hidden items-center",
                                    children: [(0, r.jsx)("span", {
                                        className: "text-primary text-xs ml-3",
                                        children: A
                                    }), (0, r.jsxs)("div", {
                                        className: (0, v.Z)("flex space-x-1", K),
                                        children: [(q ? [...C].sort((e, t) => (-1 === q.indexOf(e) ? 999 : q.indexOf(e)) - (-1 === q.indexOf(t) ? 999 : q.indexOf(t))) : C).slice(0, B).map(e => {
                                            let t = l.find(t => t.value === e);
                                            return t ? "function" == typeof t.icon ? (0, r.jsx)(t.icon, {
                                                className: "text-primary my-auto w-4 h-4 !fill-primary"
                                            }) : t.icon : null
                                        }), C.length > B && (0, r.jsx)(p.C, {
                                            className: (0, m.cn)("bg-transparent text-foreground inline-flex items-center text-xxs border-foreground/1  rounded-full h-5 min-w-5 ml-1 hover:bg-transparent", ee ? "animate-bounce" : "", N({
                                                variant: w
                                            })),
                                            children: "+ ".concat(C.length - B)
                                        })]
                                    })]
                                }) : (0, r.jsxs)("div", {
                                    className: "flex items-center overflow-hidden",
                                    children: [C.slice(0, B).map(e => {
                                        let t = l.find(t => t.value === e);
                                        return (0, r.jsxs)(p.C, {
                                            className: (0, m.cn)("py-1 hover:bg-highlight rounded-lg", ee ? "animate-bounce" : "", N({
                                                variant: w
                                            })),
                                            style: {
                                                animationDuration: "".concat(E, "s")
                                            },
                                            children: [null == t ? void 0 : t.label, (0, r.jsx)(c.Z, {
                                                className: "ml-2 h-5 w-3.5 text-gray-400 cursor-pointer",
                                                onClick: t => {
                                                    t.stopPropagation(), en(e)
                                                }
                                            })]
                                        }, e)
                                    }), C.length > B && (0, r.jsxs)(p.C, {
                                        className: (0, m.cn)("bg-transparent rounded-lg text-foreground py-1 border-foreground/1  hover:bg-transparent", ee ? "animate-bounce" : "", N({
                                            variant: w
                                        })),
                                        style: {
                                            animationDuration: "".concat(E, "s")
                                        },
                                        children: ["+ ".concat(C.length - B, " more"), (0, r.jsx)(c.Z, {
                                            className: "ml-2 h-5 w-3.5 text-gray-400 cursor-pointer",
                                            onClick: e => {
                                                e.stopPropagation(), eu()
                                            }
                                        })]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "flex items-center justify-between",
                                    children: [(0, r.jsx)(x.Z, {
                                        orientation: "vertical",
                                        className: "flex min-h-6 h-full"
                                    }), (0, r.jsx)(d.Z, {
                                        className: (0, m.cn)("mx-2 h-4 cursor-pointer", U ? "text-white/90" : "text-muted-foreground")
                                    })]
                                })]
                            }) : (0, r.jsxs)("div", {
                                className: "flex items-center justify-between w-full mx-auto",
                                children: [H ? (0, r.jsx)("div", {
                                    className: "min-w-0 overflow-hidden flex-1",
                                    children: H
                                }) : (0, r.jsx)("span", {
                                    className: "text-xs text-primary mx-3",
                                    children: A
                                }), (0, r.jsx)(d.Z, {
                                    className: (0, m.cn)("mx-2 h-4 cursor-pointer", U ? "text-white/90" : "text-muted-foreground")
                                })]
                            })
                        })
                    }), (0, r.jsx)(g.yk, {
                        className: (0, m.cn)("w-auto overflow-hidden rounded-xl border border-input-border p-0 shadow-md", G),
                        align: "start",
                        onOpenAutoFocus: e => e.preventDefault(),
                        onEscapeKeyDown: () => ed(!1),
                        children: (0, r.jsxs)(b.mY, {
                            variant: "legacy",
                            filter: y,
                            children: [(0, r.jsx)(b.sZ, {
                                placeholder: O,
                                onKeyDown: e => {
                                    if ("Enter" === e.key) ed(!0);
                                    else if ("Backspace" === e.key && !e.currentTarget.value) {
                                        let e = [...C];
                                        e.pop(), o(e)
                                    }
                                },
                                className: "border-none focus:ring-0",
                                autoFocus: !1
                            }), _ && (0, r.jsx)("div", {
                                className: "border-t border-input-border px-3 py-2 text-[11px] text-muted-foreground",
                                children: _
                            }), (0, r.jsxs)(b.e8, {
                                className: "max-h-60 custom-scrollbar",
                                children: [0 === es.length ? (0, r.jsx)("div", {
                                    className: "px-3 py-3 text-center text-sm text-muted-foreground",
                                    children: T
                                }) : (0, r.jsxs)(r.Fragment, {
                                    children: [(0, r.jsx)(b.rb, {
                                        className: "text-sm text-muted-foreground px-4 py-3",
                                        children: "No results found"
                                    }), (z || !L || !eh) && (0, r.jsxs)(b.fu, {
                                        children: [z && (0, r.jsx)(b.di, {
                                            disabled: !0,
                                            className: "text-muted-foreground text-xs py-1 opacity-70",
                                            children: "Drag to rearrange and set order"
                                        }), !L && (0, r.jsxs)(b.di, {
                                            onSelect: () => {
                                                if (C.length === l.length) eo();
                                                else {
                                                    let e = l.map(e => e.value);
                                                    o(P > 0 ? e.slice(0, P) : e)
                                                }
                                            },
                                            className: "cursor-pointer rounded-md hover:bg-blue-600/20 py-1.5 px-2",
                                            children: [(0, r.jsx)("div", {
                                                className: (0, m.cn)("mr-2 flex h-6 w-6 items-center justify-center rounded-xl border border-input-border", C.length === l.length ? "bg-gradient-to-r from-[#4040FF] to-blue-900 text-blue-300 border-blue-300/60" : "bg-input-bg hover:bg-gradient-to-r hover:from-[#4040FF]/10 hover:to-blue-900/10"),
                                                children: C.length === l.length && (0, r.jsx)(n.Z, {
                                                    className: "h-3.5 w-3.5"
                                                })
                                            }), (0, r.jsx)("span", {
                                                children: "Select All"
                                            })]
                                        }, "all"), z ? (0, r.jsx)(f.LB, {
                                            sensors: ea,
                                            collisionDetection: f.pE,
                                            onDragEnd: el,
                                            children: (0, r.jsx)(j.Fo, {
                                                items: es.map(e => e.value),
                                                strategy: j.qw,
                                                children: es.map(e => {
                                                    let t = ec(e.value),
                                                        s = 1 !== P && !t && P > 0 && C.length >= P;
                                                    return (0, r.jsx)(k, {
                                                        option: e,
                                                        isSelected: t,
                                                        isDisabled: s,
                                                        onToggle: en,
                                                        onOnlySelect: ei,
                                                        enableOnlyAction: D
                                                    }, e.value)
                                                })
                                            })
                                        }) : !eh && es.map(eg)]
                                    }), eh && ep.map((e, t) => {
                                        var s;
                                        return (0, r.jsx)(b.fu, {
                                            heading: e.group,
                                            className: "!py-0 [&_[cmdk-group-heading]]:!pt-2 [&_[cmdk-group-heading]]:!pb-0.5",
                                            children: e.options.map(eg)
                                        }, null !== (s = e.group) && void 0 !== s ? s : "section-".concat(t))
                                    })]
                                }), (0, r.jsx)(b.zz, {})]
                            }), (0, r.jsx)(b.fu, {
                                children: (0, r.jsxs)("div", {
                                    className: "flex items-center justify-between gap-0.5 p-0.5 bg-card-bg",
                                    children: [C.length > 0 && (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)(b.di, {
                                            onSelect: eo,
                                            className: "flex-1 justify-center cursor-pointer rounded-md bg-input-bg hover:bg-blue-600/20 py-2",
                                            children: "Clear"
                                        }), (0, r.jsx)(x.Z, {
                                            orientation: "vertical",
                                            className: "flex min-h-6 h-full opacity-20"
                                        })]
                                    }), (0, r.jsx)(b.di, {
                                        onSelect: () => ed(!1),
                                        className: "flex-1 justify-center cursor-pointer max-w-full rounded-md bg-input-bg hover:bg-blue-600/20 py-2",
                                        children: "Close"
                                    })]
                                })
                            })]
                        })
                    })]
                })
            });
            C.displayName = "MultiSelect"
        },
        15: function(e, t, s) {
            "use strict";
            s.d(t, {
                w: function() {
                    return i
                }
            });
            var r = s(55185),
                a = s(87743);
            let l = "sports",
                n = [];

            function i() {
                let [e, t] = (0, a._)(l, n, {
                    initializeWithValue: !1
                }), s = Array.isArray(e) ? e : n;
                (0, r.useEffect)(() => {
                    try {
                        var e;
                        if (null != window.localStorage.getItem(l)) return;
                        let s = JSON.parse(null !== (e = window.localStorage.getItem("sport")) && void 0 !== e ? e : "null");
                        "string" == typeof s && s && "all" !== s && t([s])
                    } catch (e) {}
                }, [t]);
                let i = (0, r.useCallback)(e => {
                        t(Array.from(new Set(e)).sort())
                    }, [t]),
                    o = (0, r.useCallback)(e => {
                        t("all" === e ? n : [e])
                    }, [t]),
                    d = (0, r.useCallback)(e => {
                        t(t => {
                            let s = Array.isArray(t) ? t : n;
                            return s.includes(e) ? s.filter(t => t !== e) : [...s, e].sort()
                        })
                    }, [t]),
                    c = s.join(","),
                    u = 1 === s.length ? s[0] : "all";
                return {
                    selectedSports: s,
                    sport: u,
                    sportsParam: c,
                    isAll: 0 === s.length,
                    setSelectedSports: i,
                    selectOnly: o,
                    toggleSport: d
                }
            }
        },
        88045: function(e, t, s) {
            "use strict";
            async function r(e) {
                let t = await fetch(e, {
                    method: "GET",
                    mode: "cors",
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                if (!t.ok) throw Error("An error occurred while fetching the data.");
                return t.json()
            }
            s.d(t, {
                Z: function() {
                    return r
                }
            })
        }
    }
]);