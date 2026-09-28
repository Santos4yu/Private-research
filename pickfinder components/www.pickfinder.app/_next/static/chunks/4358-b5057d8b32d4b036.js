"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4358], {
        9379: function(e, t, a) {
            a.d(t, {
                f: function() {
                    return w
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(75775),
                s = a(69237),
                d = a(59564),
                o = a(72534),
                l = a(73249),
                c = a(66961),
                u = a(97869),
                f = a(69687),
                m = a(63855),
                p = a(37260),
                b = a(58685);
            let x = "#5865F2",
                g = "We could not update your Discord access right now. Please try again or contact support@pickfinder.app.",
                h = new Set(["discord_not_linked", "discord_id_missing", "discord_token_missing", "discord_join_failed"]);
            async function v(e) {
                try {
                    let t = await e.json(),
                        a = "string" == typeof t.message && t.message.trim() ? t.message : e.ok ? "You have Discord access now." : g,
                        r = "string" == typeof t.code ? t.code : null;
                    return {
                        message: a,
                        code: r
                    }
                } catch (t) {
                    return {
                        message: e.ok ? "You have Discord access now." : g,
                        code: null
                    }
                }
            }

            function w(e) {
                let {
                    open: t,
                    onOpenChange: a
                } = e, {
                    openUserProfile: g
                } = (0, s.ll)(), [w, N] = (0, n.useState)("idle"), [j, k] = (0, n.useState)(""), [S, z] = (0, n.useState)(null), C = "loading" === w, _ = "success" === w, R = "error" === w, E = R && null !== S && h.has(S), F = e => {
                    a(e), e || (N("idle"), k(""), z(null))
                }, D = () => {
                    F(!1), g()
                }, O = async () => {
                    N("loading"), k(""), z(null);
                    try {
                        let e = await fetch("/api/discord/join", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            }),
                            {
                                message: t,
                                code: a
                            } = await v(e);
                        N(e.ok ? "success" : "error"), k(t), z(a)
                    } catch (e) {
                        N("error"), k("We could not reach Discord right now. Check your connection and try again.")
                    }
                };
                return (0, r.jsx)(m.Vq, {
                    open: t,
                    onOpenChange: F,
                    children: (0, r.jsxs)(m.cZ, {
                        className: "flex flex-col gap-0 overflow-hidden border-none rounded-lg bg-none bg-card-bg p-0 sm:max-w-[420px]",
                        children: [(0, r.jsx)(p.cb, {
                            children: (0, r.jsx)(m.$N, {
                                className: "text-primary text-base font-semibold",
                                children: "PickFinder Discord"
                            })
                        }), (0, r.jsxs)("div", {
                            className: "relative flex flex-col items-center px-5 pt-7 pb-5 text-center",
                            children: [(0, r.jsx)("div", {
                                "aria-hidden": !0,
                                className: "pointer-events-none absolute inset-x-0 top-0 h-40",
                                style: {
                                    background: "radial-gradient(60% 70% at 50% 0%, ".concat(x, "33 0%, transparent 70%)")
                                }
                            }), (0, r.jsxs)("div", {
                                className: "relative",
                                children: [(0, r.jsx)(i.default, {
                                    src: "/discord-3d.png",
                                    alt: "",
                                    width: 88,
                                    height: 88,
                                    priority: !0,
                                    className: (0, b.cn)("h-[88px] w-[88px] drop-shadow-[0_18px_30px_rgba(88,101,242,0.35)] transition-transform duration-300", _ && "scale-95")
                                }), _ && (0, r.jsx)("span", {
                                    className: "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-card-bg",
                                    children: (0, r.jsx)(d.Z, {
                                        className: "h-4 w-4 text-white",
                                        strokeWidth: 3
                                    })
                                })]
                            }), (0, r.jsx)("h3", {
                                className: "mt-5 text-[17px] font-semibold leading-tight text-primary",
                                children: _ ? "You're in" : "Included with your plan"
                            }), (0, r.jsx)(m.Be, {
                                className: "mt-1.5 max-w-[300px] text-[13px] leading-relaxed",
                                children: _ ? j : "Daily admin slips, line alerts, and the community. Link your Discord once and you get the Member role automatically."
                            })]
                        }), !_ && (0, r.jsxs)("div", {
                            className: "px-4 pb-4",
                            children: [(0, r.jsxs)("ol", {
                                className: "overflow-hidden rounded-lg border border-input-border/50 bg-highlight",
                                children: [(0, r.jsxs)("li", {
                                    className: (0, b.cn)("flex items-center gap-3 border-b border-input-border/40 px-3.5 py-3 transition-colors", E && "bg-[#5865F2]/[0.08]"),
                                    children: [(0, r.jsx)(y, {
                                        n: 1,
                                        tone: E ? "warn" : "default"
                                    }), (0, r.jsxs)("div", {
                                        className: "min-w-0 flex-1",
                                        children: [(0, r.jsx)("p", {
                                            className: "text-sm font-medium text-primary",
                                            children: "Link your Discord"
                                        }), (0, r.jsx)("p", {
                                            className: "mt-0.5 text-xs text-muted-foreground",
                                            children: "Account Settings → Connected accounts. You're added instantly."
                                        })]
                                    }), (0, r.jsxs)("button", {
                                        type: "button",
                                        onClick: D,
                                        disabled: C,
                                        className: "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-input-border/50 bg-card-header px-2.5 text-xs font-medium text-primary transition-colors hover:bg-card-header/70 disabled:opacity-50",
                                        children: ["Open", (0, r.jsx)(o.Z, {
                                            className: "h-3.5 w-3.5 text-muted-foreground"
                                        })]
                                    })]
                                }), (0, r.jsxs)("li", {
                                    className: "flex items-center gap-3 px-3.5 py-3",
                                    children: [(0, r.jsx)(y, {
                                        n: 2,
                                        tone: C ? "active" : "default"
                                    }), (0, r.jsxs)("div", {
                                        className: "min-w-0 flex-1",
                                        children: [(0, r.jsx)("p", {
                                            className: "text-sm font-medium text-primary",
                                            children: "Didn't get the role?"
                                        }), (0, r.jsx)("p", {
                                            className: "mt-0.5 text-xs text-muted-foreground",
                                            children: "Tap Join Discord below and we'll add it"
                                        })]
                                    })]
                                })]
                            }), R && (0, r.jsx)("p", {
                                role: "status",
                                "aria-live": "polite",
                                className: "mt-3 px-0.5 text-xs leading-relaxed text-red-500",
                                children: j
                            })]
                        }), (0, r.jsx)(p.Zu, {
                            className: "flex items-center justify-end gap-2 px-4",
                            children: _ ? (0, r.jsxs)(r.Fragment, {
                                children: [(0, r.jsx)(f.z, {
                                    variant: "ghost",
                                    className: "h-9 text-muted-foreground hover:text-primary",
                                    onClick: () => F(!1),
                                    children: "Done"
                                }), (0, r.jsx)(f.z, {
                                    asChild: !0,
                                    className: "h-9 text-white hover:opacity-90",
                                    style: {
                                        backgroundColor: x
                                    },
                                    children: (0, r.jsxs)("a", {
                                        href: "https://discord.gg/pickfinder",
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: [(0, r.jsx)(u.j2d, {
                                            className: "mr-2 h-4 w-4"
                                        }), "Open Discord"]
                                    })
                                })]
                            }) : E ? (0, r.jsxs)(r.Fragment, {
                                children: [(0, r.jsxs)(f.z, {
                                    variant: "ghost",
                                    className: "h-9 text-muted-foreground hover:text-primary",
                                    onClick: O,
                                    disabled: C,
                                    children: [(0, r.jsx)(l.Z, {
                                        className: "mr-2 h-3.5 w-3.5"
                                    }), "Try again"]
                                }), (0, r.jsxs)(f.z, {
                                    className: "h-9 text-white hover:opacity-90",
                                    style: {
                                        backgroundColor: x
                                    },
                                    onClick: D,
                                    children: ["Link Discord", (0, r.jsx)(o.Z, {
                                        className: "ml-1.5 h-4 w-4"
                                    })]
                                })]
                            }) : (0, r.jsxs)(r.Fragment, {
                                children: [(0, r.jsx)(f.z, {
                                    variant: "ghost",
                                    className: "h-9 text-muted-foreground hover:text-primary",
                                    onClick: () => F(!1),
                                    disabled: C,
                                    children: "Close"
                                }), (0, r.jsx)(f.z, {
                                    className: "h-9 min-w-[132px] text-white hover:opacity-90 disabled:opacity-80",
                                    style: {
                                        backgroundColor: x
                                    },
                                    onClick: O,
                                    disabled: C,
                                    children: C ? (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)(c.Z, {
                                            className: "mr-2 h-4 w-4 animate-spin"
                                        }), "Joining…"]
                                    }) : (0, r.jsxs)(r.Fragment, {
                                        children: [(0, r.jsx)(u.j2d, {
                                            className: "mr-2 h-4 w-4"
                                        }), R ? "Try again" : "Join Discord"]
                                    })
                                })]
                            })
                        })]
                    })
                })
            }

            function y(e) {
                let {
                    n: t,
                    tone: a
                } = e;
                return (0, r.jsx)("span", {
                    className: (0, b.cn)("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1", "warn" === a && "bg-[#5865F2]/25 text-[#aeb6ff] ring-[#5865F2]/60", "active" === a && "bg-[#5865F2]/20 text-[#aeb6ff] ring-[#5865F2]/50", "default" === a && "bg-white/[0.06] text-slate-300 ring-white/[0.1]"),
                    children: "active" === a ? (0, r.jsx)(c.Z, {
                        className: "h-3 w-3 animate-spin"
                    }) : t
                })
            }
        },
        37260: function(e, t, a) {
            a.d(t, {
                NU: function() {
                    return l
                },
                Vd: function() {
                    return s
                },
                Zu: function() {
                    return o
                },
                cb: function() {
                    return d
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(58685);
            let s = n.forwardRef((e, t) => {
                let {
                    children: a,
                    className: n,
                    ...s
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    className: (0, i.cn)("flex flex-col rounded-lg overflow-hidden bg-card-bg", n),
                    ...s,
                    children: a
                })
            });
            s.displayName = "FloatingCard";
            let d = n.forwardRef((e, t) => {
                let {
                    children: a,
                    className: n,
                    ...s
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    className: (0, i.cn)("py-4 bg-card-header border-b-2 border-input-border/50 text-sm flex shadow-lg items-center px-4", n),
                    ...s,
                    children: a
                })
            });
            d.displayName = "FloatingCardHeader";
            let o = n.forwardRef((e, t) => {
                let {
                    children: a,
                    className: n,
                    ...s
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    className: (0, i.cn)("py-2.5 bg-card-header border-t-2 border-input-border/50", n),
                    ...s,
                    children: a
                })
            });
            o.displayName = "FloatingCardFooter";
            let l = n.forwardRef((e, t) => {
                let {
                    children: a,
                    className: n,
                    ...s
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    className: (0, i.cn)("gap-2 overflow-y-auto custom-scrollbar", n),
                    ...s,
                    children: a
                })
            });
            l.displayName = "FloatingCardContent"
        },
        93556: function(e, t, a) {
            a.d(t, {
                I: function() {
                    return s
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(58685);
            let s = n.forwardRef((e, t) => {
                let {
                    className: a,
                    type: n,
                    ...s
                } = e;
                return (0, r.jsx)("input", {
                    type: n,
                    className: (0, i.cn)("text-primary lex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[16px] sm:text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50", a),
                    ref: t,
                    ...s
                })
            });
            s.displayName = "Input"
        },
        51465: function(e, t, a) {
            a.d(t, {
                J2: function() {
                    return d
                },
                xo: function() {
                    return o
                },
                yk: function() {
                    return l
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(49940),
                s = a(60581);
            let d = i.fC,
                o = i.xz,
                l = n.forwardRef((e, t) => {
                    let {
                        className: a,
                        align: n = "center",
                        sideOffset: d = 4,
                        ...o
                    } = e;
                    return (0, r.jsx)(i.h_, {
                        children: (0, r.jsx)(i.VY, {
                            ref: t,
                            align: n,
                            sideOffset: d,
                            className: (0, s.cn)("text-primary animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 z-50 outline-none border-input relative rounded-3xl p-6 shadow-2xl border-2 max-w-sm w-full mx-4 bg-input-bg", a),
                            ...o
                        })
                    })
                });
            l.displayName = i.VY.displayName
        },
        12402: function(e, t, a) {
            a.d(t, {
                Z: function() {
                    return d
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(6318),
                s = a(58685);
            let d = n.forwardRef((e, t) => {
                let {
                    className: a,
                    orientation: n = "horizontal",
                    decorative: d = !0,
                    ...o
                } = e;
                return (0, r.jsx)(i.f, {
                    ref: t,
                    decorative: d,
                    orientation: n,
                    className: (0, s.cn)("shrink-0 bg-border", a),
                    ...o
                })
            });
            d.displayName = i.f.displayName
        },
        38293: function(e, t, a) {
            a.d(t, {
                Ei: function() {
                    return g
                },
                Tu: function() {
                    return b
                },
                aM: function() {
                    return c
                },
                bC: function() {
                    return x
                },
                ue: function() {
                    return p
                },
                yo: function() {
                    return l
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(31468),
                s = a(60656),
                d = a(40122),
                o = a(58685);
            let l = i.fC,
                c = i.xz;
            i.x8;
            let u = i.h_,
                f = n.forwardRef((e, t) => {
                    let {
                        className: a,
                        ...n
                    } = e;
                    return (0, r.jsx)(i.aV, {
                        className: (0, o.cn)("fixed inset-0 z-50 bg-black/40  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", a),
                        ...n,
                        ref: t
                    })
                });
            f.displayName = i.aV.displayName;
            let m = (0, s.j)("fixed z-50 gap-4 bg-new-bg p-4 sm:p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500", {
                    variants: {
                        side: {
                            top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
                            bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                            left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-3xl",
                            right: "inset-y-0 right-0 h-full w-3/4  border-l border-input data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-3xl"
                        }
                    },
                    defaultVariants: {
                        side: "right"
                    }
                }),
                p = n.forwardRef((e, t) => {
                    let {
                        side: a = "right",
                        className: n,
                        children: s,
                        ...l
                    } = e;
                    return (0, r.jsxs)(u, {
                        children: [(0, r.jsx)(f, {}), (0, r.jsxs)(i.VY, {
                            ref: t,
                            className: (0, o.cn)(m({
                                side: a
                            }), n),
                            ...l,
                            children: [s, (0, r.jsxs)(i.x8, {
                                className: "absolute text-primary right-4 top-5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary",
                                children: [(0, r.jsx)(d.Z, {
                                    className: "h-4 w-4"
                                }), (0, r.jsx)("span", {
                                    className: "sr-only",
                                    children: "Close"
                                })]
                            })]
                        })]
                    })
                });
            p.displayName = i.VY.displayName;
            let b = e => {
                let {
                    className: t,
                    ...a
                } = e;
                return (0, r.jsx)("div", {
                    className: (0, o.cn)("flex flex-col space-y-2 text-center sm:text-left", t),
                    ...a
                })
            };
            b.displayName = "SheetHeader";
            let x = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)(i.Dx, {
                    ref: t,
                    className: (0, o.cn)("text-lg font-semibold text-foreground", a),
                    ...n
                })
            });
            x.displayName = i.Dx.displayName;
            let g = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)(i.dk, {
                    ref: t,
                    className: (0, o.cn)("text-sm text-muted-foreground", a),
                    ...n
                })
            });
            g.displayName = i.dk.displayName
        },
        6672: function(e, t, a) {
            a.d(t, {
                DD: function() {
                    return v
                },
                TZ: function() {
                    return k
                },
                ZW: function() {
                    return j
                },
                Hz: function() {
                    return S
                },
                Ks: function() {
                    return C
                },
                nO: function() {
                    return z
                },
                $l: function() {
                    return N
                },
                w3: function() {
                    return _
                },
                bb: function() {
                    return F
                },
                LO: function() {
                    return R
                },
                Hn: function() {
                    return h
                },
                wJ: function() {
                    return y
                },
                vP: function() {
                    return w
                },
                Ap: function() {
                    return g
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(33658),
                s = a(60656),
                d = a(58120),
                o = a(37220),
                l = a(87786),
                c = a(69687),
                u = a(93556),
                f = a(12402),
                m = a(38293),
                p = a(49163),
                b = a(50555);
            let x = n.createContext(null);

            function g() {
                let e = n.useContext(x);
                if (!e) throw Error("useSidebar must be used within a SidebarProvider.");
                return e
            }
            let h = n.forwardRef((e, t) => {
                let {
                    defaultOpen: a = !0,
                    open: i,
                    onOpenChange: s,
                    className: d,
                    style: c,
                    children: u,
                    ...f
                } = e, m = function() {
                    let [e, t] = n.useState(!1);
                    return n.useEffect(() => {
                        let e = () => {
                            t(window.innerWidth < 768)
                        };
                        e();
                        let a = window.matchMedia("(max-width: ".concat(767, "px)"));
                        return a.addEventListener("change", e), window.addEventListener("resize", e), window.addEventListener("orientationchange", e), () => {
                            a.removeEventListener("change", e), window.removeEventListener("resize", e), window.removeEventListener("orientationchange", e)
                        }
                    }, []), e
                }(), p = (0, o.a)("(min-width: 768px) and (max-width: 1024px)"), g = (0, o.a)("(min-width: 1024px)"), [h, v] = n.useState(!1), [w, y] = n.useState(a), N = null != i ? i : w, j = n.useCallback(e => {
                    let t = "function" == typeof e ? e(N) : e;
                    s ? s(t) : y(t), document.cookie = "".concat("sidebar:state", "=").concat(t, "; path=/; max-age=").concat(604800)
                }, [s, N]), k = n.useCallback(() => m ? v(e => !e) : j(e => !e), [m, j, v]);
                n.useEffect(() => {
                    p && j(!1)
                }, [p]), n.useEffect(() => {
                    g && j(!0)
                }, [g]), n.useEffect(() => {
                    let e = e => {
                        "b" === e.key && (e.metaKey || e.ctrlKey) && (e.preventDefault(), k())
                    };
                    return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e)
                }, [k]);
                let S = N ? "expanded" : "collapsed",
                    z = n.useMemo(() => ({
                        state: S,
                        open: N,
                        setOpen: j,
                        isMobile: m,
                        openMobile: h,
                        setOpenMobile: v,
                        toggleSidebar: k
                    }), [S, N, j, m, h, v, k]);
                return (0, r.jsx)(x.Provider, {
                    value: z,
                    children: (0, r.jsx)(b.pn, {
                        delayDuration: 0,
                        children: (0, r.jsx)("div", {
                            style: {
                                "--sidebar-width": "16rem",
                                "--sidebar-width-icon": "3rem",
                                ...c
                            },
                            className: (0, l.cn)("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar", d),
                            ref: t,
                            ...f,
                            children: u
                        })
                    })
                })
            });
            h.displayName = "SidebarProvider";
            let v = n.forwardRef((e, t) => {
                let {
                    side: a = "left",
                    variant: n = "sidebar",
                    collapsible: i = "offcanvas",
                    className: s,
                    children: d,
                    ...o
                } = e, {
                    isMobile: c,
                    state: u,
                    openMobile: f,
                    setOpenMobile: p
                } = g();
                return "none" === i ? (0, r.jsx)("div", {
                    className: (0, l.cn)("flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground", s),
                    ref: t,
                    ...o,
                    children: d
                }) : c ? (0, r.jsx)(m.yo, {
                    open: f,
                    onOpenChange: p,
                    ...o,
                    children: (0, r.jsx)(m.ue, {
                        "data-sidebar": "sidebar",
                        "data-mobile": "true",
                        className: "w-[--sidebar-width] border-none bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden",
                        style: {
                            "--sidebar-width": "18rem"
                        },
                        side: a,
                        children: (0, r.jsx)("div", {
                            className: "flex h-full w-full flex-col",
                            children: d
                        })
                    })
                }) : (0, r.jsx)("div", {
                    ref: t,
                    className: "group peer hidden md:block text-sidebar-foreground",
                    "data-state": u,
                    "data-collapsible": "collapsed" === u ? i : "",
                    "data-variant": n,
                    "data-side": a,
                    children: (0, r.jsx)("div", {
                        className: (0, l.cn)("relative h-svh w-[--sidebar-width] shrink-0 bg-sidebar transition-[width] duration-200 ease-custom-ease", "floating" === n || "inset" === n ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]" : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=right]:border-l", s),
                        ...o,
                        children: (0, r.jsx)("div", {
                            "data-sidebar": "sidebar",
                            className: "flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow",
                            children: d
                        })
                    })
                })
            });
            v.displayName = "Sidebar";
            let w = n.forwardRef((e, t) => {
                let {
                    className: a,
                    onClick: n,
                    ...i
                } = e, {
                    toggleSidebar: s
                } = g();
                return (0, r.jsxs)(c.z, {
                    ref: t,
                    "data-sidebar": "trigger",
                    variant: "ghost",
                    size: "icon",
                    className: (0, l.cn)("h-7 w-7 text-white hover:bg-blue-300/30", a),
                    onClick: e => {
                        null == n || n(e), s()
                    },
                    ...i,
                    children: [(0, r.jsx)(d.Z, {
                        size: 20
                    }), (0, r.jsx)("span", {
                        className: "sr-only",
                        children: "Toggle Sidebar"
                    })]
                })
            });
            w.displayName = "SidebarTrigger";
            let y = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e, {
                    toggleSidebar: i
                } = g();
                return (0, r.jsx)("button", {
                    ref: t,
                    "data-sidebar": "rail",
                    "aria-label": "Toggle Sidebar",
                    tabIndex: -1,
                    onClick: i,
                    title: "Toggle Sidebar",
                    className: (0, l.cn)("absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex", "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize", "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize", "after:transition-colors hover:after:bg-sidebar-border", "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar", "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2", "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2", a),
                    ...n
                })
            });
            y.displayName = "SidebarRail", n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("main", {
                    ref: t,
                    className: (0, l.cn)("relative flex min-h-svh flex-1 flex-col bg-background", "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow", a),
                    ...n
                })
            }).displayName = "SidebarInset", n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)(u.I, {
                    ref: t,
                    "data-sidebar": "input",
                    className: (0, l.cn)("h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:", a),
                    ...n
                })
            }).displayName = "SidebarInput";
            let N = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "header",
                    className: (0, l.cn)("flex flex-col gap-2 p-2", a),
                    ...n
                })
            });
            N.displayName = "SidebarHeader";
            let j = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "footer",
                    className: (0, l.cn)("flex flex-col gap-2 p-2", a),
                    ...n
                })
            });
            j.displayName = "SidebarFooter", n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)(f.Z, {
                    ref: t,
                    "data-sidebar": "separator",
                    className: (0, l.cn)("mx-2 w-auto bg-sidebar-border", a),
                    ...n
                })
            }).displayName = "SidebarSeparator";
            let k = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "content",
                    className: (0, l.cn)("flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden", a),
                    ...n
                })
            });
            k.displayName = "SidebarContent";
            let S = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "group",
                    className: (0, l.cn)("relative flex w-full min-w-0 flex-col px-2 py-1.5", a),
                    ...n
                })
            });
            S.displayName = "SidebarGroup";
            let z = n.forwardRef((e, t) => {
                let {
                    className: a,
                    asChild: n = !1,
                    ...s
                } = e, d = n ? i.g7 : "div";
                return (0, r.jsx)(d, {
                    ref: t,
                    "data-sidebar": "group-label",
                    className: (0, l.cn)("mb-1 flex h-8 shrink-0 items-center rounded-md px-2.5 text-[11px] font-medium tracking-wide text-sidebar-foreground/45 outline-none transition-[margin,opacity] duration-200 ease-custom-ease focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0", "group-data-[collapsible=icon]:-mt-9 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-z-10", a),
                    ...s
                })
            });
            z.displayName = "SidebarGroupLabel", n.forwardRef((e, t) => {
                let {
                    className: a,
                    asChild: n = !1,
                    ...s
                } = e, d = n ? i.g7 : "button";
                return (0, r.jsx)(d, {
                    ref: t,
                    "data-sidebar": "group-action",
                    className: (0, l.cn)("absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none  hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0", "after:absolute after:-inset-2 after:md:hidden", "group-data-[collapsible=icon]:hidden", a),
                    ...s
                })
            }).displayName = "SidebarGroupAction";
            let C = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "group-content",
                    className: (0, l.cn)("w-full text-sm", a),
                    ...n
                })
            });
            C.displayName = "SidebarGroupContent";
            let _ = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("ul", {
                    ref: t,
                    "data-sidebar": "menu",
                    className: (0, l.cn)("flex w-full min-w-0 flex-col gap-1", a),
                    ...n
                })
            });
            _.displayName = "SidebarMenu";
            let R = n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("li", {
                    ref: t,
                    "data-sidebar": "menu-item",
                    className: (0, l.cn)("group/menu-item relative", a),
                    ...n
                })
            });
            R.displayName = "SidebarMenuItem";
            let E = (0, s.j)("peer/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left text-[13px] font-medium text-sidebar-foreground/70 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] data-[active=true]:[&>svg]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-foreground/55 [&>svg]:transition-colors [&>svg]:duration-150", {
                    variants: {
                        variant: {
                            default: "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:[&>svg]:text-sidebar-accent-foreground active:bg-sidebar-accent",
                            outline: "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
                        },
                        size: {
                            default: "h-9",
                            sm: "h-8 text-xs",
                            lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0"
                        }
                    },
                    defaultVariants: {
                        variant: "default",
                        size: "default"
                    }
                }),
                F = n.forwardRef((e, t) => {
                    let {
                        asChild: a = !1,
                        isActive: n = !1,
                        variant: s = "default",
                        size: d = "default",
                        tooltip: o,
                        className: c,
                        ...u
                    } = e, f = a ? i.g7 : "button", {
                        isMobile: m,
                        state: p
                    } = g(), x = (0, r.jsx)(f, {
                        ref: t,
                        "data-sidebar": "menu-button",
                        "data-size": d,
                        "data-active": n,
                        className: (0, l.cn)(E({
                            variant: s,
                            size: d
                        }), c),
                        ...u
                    });
                    return o ? ("string" == typeof o && (o = {
                        children: o
                    }), (0, r.jsxs)(b.u, {
                        children: [(0, r.jsx)(b.aJ, {
                            asChild: !0,
                            children: x
                        }), (0, r.jsx)(b._v, {
                            side: "right",
                            align: "center",
                            hidden: "collapsed" !== p || m,
                            ...o
                        })]
                    })) : x
                });
            F.displayName = "SidebarMenuButton", n.forwardRef((e, t) => {
                let {
                    className: a,
                    asChild: n = !1,
                    showOnHover: s = !1,
                    ...d
                } = e, o = n ? i.g7 : "button";
                return (0, r.jsx)(o, {
                    ref: t,
                    "data-sidebar": "menu-action",
                    className: (0, l.cn)("absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none  hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0", "after:absolute after:-inset-2 after:md:hidden", "peer-data-[size=sm]/menu-button:top-1", "peer-data-[size=default]/menu-button:top-1.5", "peer-data-[size=lg]/menu-button:top-2.5", "group-data-[collapsible=icon]:hidden", s && "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0", a),
                    ...d
                })
            }).displayName = "SidebarMenuAction", n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("div", {
                    ref: t,
                    "data-sidebar": "menu-badge",
                    className: (0, l.cn)("absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none", "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground", "peer-data-[size=sm]/menu-button:top-1", "peer-data-[size=default]/menu-button:top-1.5", "peer-data-[size=lg]/menu-button:top-2.5", "group-data-[collapsible=icon]:hidden", a),
                    ...n
                })
            }).displayName = "SidebarMenuBadge", n.forwardRef((e, t) => {
                let {
                    className: a,
                    showIcon: i = !1,
                    ...s
                } = e, d = n.useMemo(() => "".concat(Math.floor(40 * Math.random()) + 50, "%"), []);
                return (0, r.jsxs)("div", {
                    ref: t,
                    "data-sidebar": "menu-skeleton",
                    className: (0, l.cn)("rounded-md h-8 flex gap-2 px-2 items-center", a),
                    ...s,
                    children: [i && (0, r.jsx)(p.O, {
                        className: "size-4 rounded-md",
                        "data-sidebar": "menu-skeleton-icon"
                    }), (0, r.jsx)(p.O, {
                        className: "h-4 flex-1 max-w-[--skeleton-width]",
                        "data-sidebar": "menu-skeleton-text",
                        style: {
                            "--skeleton-width": d
                        }
                    })]
                })
            }).displayName = "SidebarMenuSkeleton", n.forwardRef((e, t) => {
                let {
                    className: a,
                    ...n
                } = e;
                return (0, r.jsx)("ul", {
                    ref: t,
                    "data-sidebar": "menu-sub",
                    className: (0, l.cn)("mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5", "group-data-[collapsible=icon]:hidden", a),
                    ...n
                })
            }).displayName = "SidebarMenuSub", n.forwardRef((e, t) => {
                let { ...a
                } = e;
                return (0, r.jsx)("li", {
                    ref: t,
                    ...a
                })
            }).displayName = "SidebarMenuSubItem", n.forwardRef((e, t) => {
                let {
                    asChild: a = !1,
                    size: n = "md",
                    isActive: s,
                    className: d,
                    ...o
                } = e, c = a ? i.g7 : "a";
                return (0, r.jsx)(c, {
                    ref: t,
                    "data-sidebar": "menu-sub-button",
                    "data-size": n,
                    "data-active": s,
                    className: (0, l.cn)("flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none  hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground", "data-[active=true]:bg-input-bg data-[active=true]:text-sidebar-accent-foreground", "sm" === n && "text-xs", "md" === n && "text-sm", "group-data-[collapsible=icon]:hidden", d),
                    ...o
                })
            }).displayName = "SidebarMenuSubButton"
        },
        49163: function(e, t, a) {
            a.d(t, {
                O: function() {
                    return i
                }
            });
            var r = a(10131),
                n = a(58685);

            function i(e) {
                let {
                    className: t,
                    ...a
                } = e;
                return (0, r.jsx)("div", {
                    className: (0, n.cn)("animate-pulse rounded-md bg-highlight", t),
                    ...a
                })
            }
        },
        50555: function(e, t, a) {
            a.d(t, {
                _v: function() {
                    return c
                },
                aJ: function() {
                    return l
                },
                pn: function() {
                    return d
                },
                u: function() {
                    return o
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(24911),
                s = a(60581);
            let d = i.zt,
                o = e => {
                    let { ...t
                    } = e;
                    return (0, r.jsx)(i.fC, { ...t
                    })
                };
            o.displayName = i.u.displayName;
            let l = i.xz,
                c = n.forwardRef((e, t) => {
                    let {
                        className: a,
                        sideOffset: n = 4,
                        ...d
                    } = e;
                    return (0, r.jsx)(i.h_, {
                        children: (0, r.jsx)(i.VY, {
                            ref: t,
                            sideOffset: n,
                            side: "bottom",
                            className: (0, s.cn)("z-50 overflow-hidden text-wrap max-w-md rounded-md px-3 py-1.5 text-sm shadow-md animate-in fade-in-50 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 bg-slate-900 text-slate-400", a),
                            ...d
                        })
                    })
                });
            c.displayName = i.VY.displayName
        },
        86917: function(e, t, a) {
            a.d(t, {
                V: function() {
                    return o
                },
                b: function() {
                    return d
                }
            });
            var r = a(10131),
                n = a(55185),
                i = a(93630);
            let s = (0, n.createContext)({});

            function d(e) {
                let {
                    value: t,
                    children: a
                } = e;
                return (0, r.jsx)(s.Provider, {
                    value: t,
                    children: a
                })
            }

            function o() {
                let e = (0, n.useContext)(s);
                return (0, n.useMemo)(() => {
                    if (!Object.keys(e).length) return i.ZP;
                    let t = {};
                    for (let [n, s] of Object.entries(i.ZP)) {
                        var a, r;
                        let i = e[n];
                        t[n] = i ? { ...s,
                            enabled: i.enabled,
                            startTimeText: null !== (a = i.startTimeText) && void 0 !== a ? a : s.startTimeText,
                            statSeason: null !== (r = i.statSeason) && void 0 !== r ? r : s.statSeason
                        } : s
                    }
                    return t
                }, [e])
            }
        },
        37220: function(e, t, a) {
            a.d(t, {
                a: function() {
                    return n
                }
            });
            var r = a(55185);

            function n(e) {
                let [t, a] = (0, r.useState)(!1);
                return (0, r.useEffect)(() => {
                    let r = window.matchMedia(e);
                    r.matches !== t && a(r.matches);
                    let n = () => a(r.matches);
                    return r.addEventListener("change", n), () => r.removeEventListener("change", n)
                }, [t, e]), t
            }
        },
        87743: function(e, t, a) {
            a.d(t, {
                _: function() {
                    return i
                }
            });
            var r = a(55185),
                n = a(2982);

            function i(e, t) {
                let a = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
                    {
                        initializeWithValue: i = !0
                    } = a,
                    s = (0, r.useCallback)(e => a.serializer ? a.serializer(e) : JSON.stringify(e), [a]),
                    d = (0, r.useCallback)(e => {
                        let r;
                        if (a.deserializer) return a.deserializer(e);
                        if ("undefined" === e) return;
                        let n = t instanceof Function ? t() : t;
                        try {
                            r = JSON.parse(e)
                        } catch (e) {
                            return console.error("Error parsing JSON:", e), n
                        }
                        return r
                    }, [a, t]),
                    o = (0, r.useCallback)(() => {
                        let a = t instanceof Function ? t() : t;
                        try {
                            let t = window.localStorage.getItem(e);
                            return t ? d(t) : a
                        } catch (t) {
                            return console.warn("Error reading localStorage key “".concat(e, "”:"), t), a
                        }
                    }, [t, e, d]),
                    [l, c] = (0, r.useState)(() => i ? o() : t instanceof Function ? t() : t),
                    u = (0, n.$0)(t => {
                        try {
                            let a = t instanceof Function ? t(o()) : t;
                            window.localStorage.setItem(e, s(a)), c(a), window.dispatchEvent(new StorageEvent("local-storage", {
                                key: e
                            }))
                        } catch (t) {
                            console.warn("Error setting localStorage key “".concat(e, "”:"), t)
                        }
                    }),
                    f = (0, n.$0)(() => {
                        let a = t instanceof Function ? t() : t;
                        window.localStorage.removeItem(e), c(a), window.dispatchEvent(new StorageEvent("local-storage", {
                            key: e
                        }))
                    });
                (0, r.useEffect)(() => {
                    c(o())
                }, [e]);
                let m = (0, r.useCallback)(t => {
                    t.key && t.key !== e || c(o())
                }, [e, o]);
                return (0, n.OR)("storage", m), (0, n.OR)("local-storage", m), [l, u, f]
            }
        },
        60581: function(e, t, a) {
            a.d(t, {
                cn: function() {
                    return i
                }
            });
            var r = a(63210),
                n = a(86470);

            function i() {
                for (var e = arguments.length, t = Array(e), a = 0; a < e; a++) t[a] = arguments[a];
                return (0, n.m)((0, r.W)(t))
            }
        }
    }
]);