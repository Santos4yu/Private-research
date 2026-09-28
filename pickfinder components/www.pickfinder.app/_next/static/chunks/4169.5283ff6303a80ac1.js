"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4169], {
        44169: function(e, t, r) {
            r.r(t), r.d(t, {
                MobileTabSwitcher: function() {
                    return F
                }
            });
            var i = r(10131),
                n = r(67057),
                s = r(41915),
                a = r(47068),
                l = r(48307),
                o = r(75837),
                c = r(70083),
                d = r(95820),
                u = r(84003),
                p = r(93368),
                m = r(50761),
                f = r(63210),
                h = r(55185),
                x = r(600),
                v = r(32365),
                g = r(1141);
            class b extends h.Component {
                getSnapshotBeforeUpdate(e) {
                    let t = this.props.childRef.current;
                    if (t && e.isPresent && !this.props.isPresent) {
                        let e = this.props.sizeRef.current;
                        e.height = t.offsetHeight || 0, e.width = t.offsetWidth || 0, e.top = t.offsetTop, e.left = t.offsetLeft
                    }
                    return null
                }
                componentDidUpdate() {}
                render() {
                    return this.props.children
                }
            }

            function w({
                children: e,
                isPresent: t
            }) {
                let r = (0, h.useId)(),
                    n = (0, h.useRef)(null),
                    s = (0, h.useRef)({
                        width: 0,
                        height: 0,
                        top: 0,
                        left: 0
                    }),
                    {
                        nonce: a
                    } = (0, h.useContext)(g._);
                return (0, h.useInsertionEffect)(() => {
                    let {
                        width: e,
                        height: i,
                        top: l,
                        left: o
                    } = s.current;
                    if (t || !n.current || !e || !i) return;
                    n.current.dataset.motionPopId = r;
                    let c = document.createElement("style");
                    return a && (c.nonce = a), document.head.appendChild(c), c.sheet && c.sheet.insertRule(`
          [data-motion-pop-id="${r}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${i}px !important;
            top: ${l}px !important;
            left: ${o}px !important;
          }
        `), () => {
                        document.head.removeChild(c)
                    }
                }, [t]), (0, i.jsx)(b, {
                    isPresent: t,
                    childRef: n,
                    sizeRef: s,
                    children: h.cloneElement(e, {
                        ref: n
                    })
                })
            }
            let y = ({
                children: e,
                initial: t,
                isPresent: r,
                onExitComplete: n,
                custom: s,
                presenceAffectsLayout: a,
                mode: l
            }) => {
                let o = (0, v.h)(j),
                    c = (0, h.useId)(),
                    d = (0, h.useMemo)(() => ({
                        id: c,
                        initial: t,
                        isPresent: r,
                        custom: s,
                        onExitComplete: e => {
                            for (let t of (o.set(e, !0), o.values()))
                                if (!t) return;
                            n && n()
                        },
                        register: e => (o.set(e, !1), () => o.delete(e))
                    }), a ? [Math.random()] : [r]);
                return (0, h.useMemo)(() => {
                    o.forEach((e, t) => o.set(t, !1))
                }, [r]), h.useEffect(() => {
                    r || o.size || !n || n()
                }, [r]), "popLayout" === l && (e = (0, i.jsx)(w, {
                    isPresent: r,
                    children: e
                })), (0, i.jsx)(x.O.Provider, {
                    value: d,
                    children: e
                })
            };

            function j() {
                return new Map
            }
            var P = r(82320),
                E = r(86025);
            let N = e => e.key || "";

            function k(e) {
                let t = [];
                return h.Children.forEach(e, e => {
                    (0, h.isValidElement)(e) && t.push(e)
                }), t
            }
            var _ = r(32179);
            let C = ({
                children: e,
                exitBeforeEnter: t,
                custom: r,
                initial: n = !0,
                onExitComplete: s,
                presenceAffectsLayout: a = !0,
                mode: l = "sync"
            }) => {
                (0, E.k)(!t, "Replace exitBeforeEnter with mode='wait'");
                let o = (0, h.useMemo)(() => k(e), [e]),
                    c = o.map(N),
                    d = (0, h.useRef)(!0),
                    u = (0, h.useRef)(o),
                    p = (0, v.h)(() => new Map),
                    [m, f] = (0, h.useState)(o),
                    [x, g] = (0, h.useState)(o);
                (0, _.L)(() => {
                    d.current = !1, u.current = o;
                    for (let e = 0; e < x.length; e++) {
                        let t = N(x[e]);
                        c.includes(t) ? p.delete(t) : !0 !== p.get(t) && p.set(t, !1)
                    }
                }, [x, c.length, c.join("-")]);
                let b = [];
                if (o !== m) {
                    let e = [...o];
                    for (let t = 0; t < x.length; t++) {
                        let r = x[t],
                            i = N(r);
                        c.includes(i) || (e.splice(t, 0, r), b.push(r))
                    }
                    "wait" === l && b.length && (e = b), g(k(e)), f(o);
                    return
                }
                let {
                    forceRender: w
                } = (0, h.useContext)(P.p);
                return (0, i.jsx)(i.Fragment, {
                    children: x.map(e => {
                        let t = N(e),
                            m = o === x || c.includes(t);
                        return (0, i.jsx)(y, {
                            isPresent: m,
                            initial: (!d.current || !!n) && void 0,
                            custom: m ? void 0 : r,
                            presenceAffectsLayout: a,
                            mode: l,
                            onExitComplete: m ? void 0 : () => {
                                if (!p.has(t)) return;
                                p.set(t, !0);
                                let e = !0;
                                p.forEach(t => {
                                    t || (e = !1)
                                }), e && (null == w || w(), g(u.current), s && s())
                            },
                            children: e
                        }, t)
                    })
                })
            };
            var A = r(8161),
                M = r(69237),
                Z = r(8933),
                S = r(9379),
                D = r(28876),
                R = r(34772),
                W = r(68886);
            let z = e => {
                    let {
                        size: t = 24,
                        className: r
                    } = e;
                    return (0, i.jsx)("svg", {
                        width: t,
                        height: t,
                        viewBox: "0 0 24 24",
                        fill: "none",
                        xmlns: "http://www.w3.org/2000/svg",
                        className: (0, f.Z)("fill-current", r),
                        children: (0, i.jsx)("path", {
                            d: "M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.02.06.03.09.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"
                        })
                    })
                },
                L = [{
                    title: "EV+",
                    url: "/positive-ev",
                    icon: a.Z
                }, {
                    title: "Arbitrage",
                    url: "/arbitrage",
                    icon: l.Z
                }, {
                    title: "Middles",
                    url: "/middles",
                    icon: o.Z
                }],
                T = "relative flex flex-col items-center justify-center flex-1 h-full pt-1";

            function F() {
                var e;
                let t = (0, n.usePathname)(),
                    r = (0, n.useParams)();
                null == r || r.sport;
                let [a, l] = (0, h.useState)(null), [o, x] = (0, h.useState)(!1), [v, g] = (0, h.useState)(!1), [b, w] = (0, h.useState)(!1), [y, j] = (0, h.useState)(!1), P = (0, h.useRef)(null), E = (0, h.useRef)(null), N = (0, h.useRef)(new WeakMap), k = (0, h.useRef)(!1), {
                    user: _,
                    isLoaded: F,
                    isSignedIn: I
                } = (0, M.aF)(), U = (0, D.nt)(null == _ ? void 0 : null === (e = _.publicMetadata) || void 0 === e ? void 0 : e.plan), $ = v && F && !U, {
                    state: V
                } = (0, W.sx)(), {
                    openProGate: B
                } = (0, W.An)(), H = v && F && (D.gT || "Admin" === V.plan), [Y, O] = (0, h.useState)(!1), X = D.gT && !V.hasPro && !Y, q = L.some(e => t.startsWith(e.url)), G = H && X && V.isTrialEligible, J = [{
                    title: "Props",
                    url: "/props",
                    icon: c.Z,
                    isActive: t.startsWith("/props"),
                    activeColor: "border-blue-500"
                }, ...H ? [] : [{
                    title: "Players",
                    url: "/players",
                    icon: d.Z,
                    isActive: t.startsWith("/players"),
                    activeColor: "border-green-500"
                }], {
                    title: "Popular",
                    url: "/popular",
                    icon: u.Z,
                    isActive: t.startsWith("/popular"),
                    activeColor: "border-orange-500"
                }, {
                    title: "Discrep",
                    url: "/discrepancies",
                    icon: p.Z,
                    isActive: t.startsWith("/discrepancies"),
                    activeColor: "border-purple-500"
                }], K = e => {
                    l(e), setTimeout(() => l(null), 300)
                };
                (0, h.useEffect)(() => {
                    g(!0)
                }, []), (0, h.useEffect)(() => {
                    j(!1)
                }, [t]), (0, h.useEffect)(() => {
                    o && j(!1)
                }, [o]), (0, h.useEffect)(() => {
                    if (!y) return;
                    let e = e => {
                            var t, r;
                            let i = e.target;
                            (null === (t = P.current) || void 0 === t ? void 0 : t.contains(i)) || (null === (r = E.current) || void 0 === r ? void 0 : r.contains(i)) || j(!1)
                        },
                        t = e => {
                            "Escape" === e.key && j(!1)
                        };
                    return document.addEventListener("pointerdown", e), document.addEventListener("keydown", t), () => {
                        document.removeEventListener("pointerdown", e), document.removeEventListener("keydown", t)
                    }
                }, [y]);
                let Q = (0, h.useCallback)(e => {
                    k.current !== e && (k.current = e, x(e))
                }, []);
                (0, h.useEffect)(() => {
                    N.current = new WeakMap, Q(!1)
                }, [t, Q]), (0, h.useEffect)(() => {
                    let e = window.matchMedia("(max-width: 767px)"),
                        t = e => {
                            if (e instanceof Document) {
                                var t, r;
                                return null !== (r = null === (t = e.scrollingElement) || void 0 === t ? void 0 : t.scrollTop) && void 0 !== r ? r : window.scrollY
                            }
                            return e instanceof Element ? e.scrollTop : window.scrollY
                        },
                        r = e => e instanceof Document || e instanceof Element && e.scrollHeight > e.clientHeight + 1,
                        i = i => {
                            var n, s;
                            if (!e.matches) return;
                            let a = null !== (n = i.target) && void 0 !== n ? n : document;
                            if (!r(a)) return;
                            let l = t(a),
                                o = null !== (s = N.current.get(a)) && void 0 !== s ? s : l,
                                c = l - o;
                            if (N.current.set(a, l), l <= 8) {
                                Q(!1);
                                return
                            }
                            c > 8 && l > 48 ? Q(!0) : c < -4 && Q(!1)
                        },
                        n = () => {
                            e.matches || Q(!1)
                        };
                    return document.addEventListener("scroll", i, {
                        capture: !0,
                        passive: !0
                    }), e.addEventListener("change", n), () => {
                        document.removeEventListener("scroll", i, !0), e.removeEventListener("change", n)
                    }
                }, [Q]);
                let ee = () => /Mobi|Android|iPhone|PWAShell|iPad|iPod/.test(window.navigator.userAgent),
                    et = () => window.matchMedia("(display-mode: standalone)").matches || document.referrer.includes("android-app://") || navigator.userAgent.includes("PWAShell"),
                    er = () => et() && ee(),
                    ei = (J.length + .5) / (J.length + 2) * 100;
                return (0, i.jsxs)("div", {
                    className: (0, f.Z)("w-[90%] mx-auto absolute bottom-5 z-[49] left-0 right-0 md:hidden", "transition-[transform,opacity] duration-300 ease-out will-change-transform", o ? "translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"),
                    children: [(0, i.jsx)(C, {
                        children: H && y && (0, i.jsx)("div", {
                            ref: E,
                            role: "menu",
                            "aria-label": "Pro tools",
                            className: "absolute bottom-full mb-3 flex -translate-x-1/2 items-end gap-3",
                            style: {
                                left: "".concat(ei, "%")
                            },
                            children: L.map((e, r) => {
                                let n = t.startsWith(e.url),
                                    a = 1 === r,
                                    l = (1 - r) * 44;
                                return (0, i.jsxs)(A.E.div, {
                                    className: (0, f.Z)("flex flex-col items-center gap-1.5", a && "mb-3"),
                                    style: {
                                        originY: 1
                                    },
                                    initial: {
                                        opacity: 0,
                                        scale: .35,
                                        x: l,
                                        y: 40
                                    },
                                    animate: {
                                        opacity: 1,
                                        scale: 1,
                                        x: 0,
                                        y: 0
                                    },
                                    exit: {
                                        opacity: 0,
                                        scale: .4,
                                        x: .6 * l,
                                        y: 28,
                                        transition: {
                                            duration: .16,
                                            ease: "easeIn"
                                        }
                                    },
                                    transition: {
                                        type: "spring",
                                        stiffness: 460,
                                        damping: 26,
                                        mass: .8,
                                        delay: a ? 0 : .045
                                    },
                                    children: [(0, i.jsxs)(s.default, {
                                        href: e.url,
                                        prefetch: !0,
                                        role: "menuitem",
                                        "aria-current": n ? "page" : void 0,
                                        "aria-label": e.title,
                                        onClick: () => j(!1),
                                        className: (0, f.Z)("relative grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border backdrop-blur-sm transition-[transform,background-color] active:scale-95", "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_32px_-12px_rgba(0,0,0,0.7)]", n ? "border-white/25 bg-card-bg/90" : "border-white/15 bg-card-bg/70"),
                                        children: [(0, i.jsx)("span", {
                                            "aria-hidden": !0,
                                            className: "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.10] to-transparent"
                                        }), (0, i.jsx)(e.icon, {
                                            size: 21,
                                            strokeWidth: 1.75,
                                            className: "relative text-white"
                                        })]
                                    }), (0, i.jsx)("span", {
                                        className: "text-[10px] font-medium leading-none text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_6px_rgba(0,0,0,0.9)]",
                                        children: e.title
                                    })]
                                }, e.url)
                            })
                        })
                    }), (0, i.jsx)("div", {
                        className: "rounded-full border border-white/15 bg-card-bg/70 backdrop-blur-sm",
                        children: (0, i.jsxs)("div", {
                            className: "flex justify-around items-center pb-4 pt-3",
                            children: [J.map(e => {
                                let t = "/players" === e.url && $,
                                    r = (0, f.Z)(T, e.isActive ? "" : "border-transparent", t && "appearance-none border-0 bg-transparent text-inherit"),
                                    n = (0, i.jsxs)(i.Fragment, {
                                        children: [(0, i.jsx)(e.icon, {
                                            size: 20,
                                            className: e.isActive ? "text-primary" : "text-muted-foreground"
                                        }), (0, i.jsx)("span", {
                                            className: (0, f.Z)("text-xxs mt-1", e.isActive ? "text-primary font-medium" : "text-muted-foreground"),
                                            children: e.title
                                        }), a === e.title && (0, i.jsx)("span", {
                                            className: "absolute inset-0 bg-primary/5 animate-ripple"
                                        })]
                                    });
                                return t ? (0, i.jsx)(Z.vX, {
                                    asChild: !0,
                                    onClick: () => {
                                        var t;
                                        K(e.title), R.co.trackLockedFilterClicked({
                                            source: "player_page",
                                            featureName: "Player Pages",
                                            trigger: "player_search_mobile_tab",
                                            ...(0, R.cz)({
                                                isSignedIn: I,
                                                plan: null == _ ? void 0 : null === (t = _.publicMetadata) || void 0 === t ? void 0 : t.plan,
                                                isPwa: er(),
                                                isWebView: "undefined" != typeof navigator && navigator.userAgent.includes("PWAShell")
                                            })
                                        })
                                    },
                                    featureName: "Player Pages",
                                    title: "Unlock Player Search",
                                    description: "Search every player, open full stat pages, and join our premium Discord with admin picks.",
                                    benefits: D.vR.playerSearch,
                                    source: "player_page",
                                    children: (0, i.jsx)("button", {
                                        type: "button",
                                        className: r,
                                        "aria-label": e.title,
                                        children: n
                                    })
                                }, e.title) : (0, i.jsx)(s.default, {
                                    href: e.url,
                                    prefetch: !0,
                                    onClick: () => K(e.title),
                                    className: r,
                                    "aria-label": e.title,
                                    children: n
                                }, e.title)
                            }), H && (0, i.jsx)("div", {
                                ref: P,
                                className: "relative flex flex-1 self-stretch",
                                children: (0, i.jsxs)("button", {
                                    type: "button",
                                    className: (0, f.Z)(T, "w-full appearance-none border-0 bg-transparent text-inherit"),
                                    "aria-label": X ? "Pro (locked)" : "Pro",
                                    "aria-haspopup": X ? void 0 : "menu",
                                    "aria-expanded": X ? void 0 : y,
                                    onClick: () => {
                                        if (K("Pro"), X) {
                                            j(!1), B("mobile_tab_pro");
                                            return
                                        }
                                        j(e => !e)
                                    },
                                    children: [(0, i.jsxs)("span", {
                                        className: (0, f.Z)("relative flex transition-transform duration-200 ease-out", y && "scale-110"),
                                        children: [(0, i.jsx)(m.Z, {
                                            size: 20,
                                            className: q || y ? "text-primary" : "text-muted-foreground"
                                        }), G && (0, i.jsx)("span", {
                                            "aria-hidden": !0,
                                            className: "absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#3461FF]"
                                        })]
                                    }), (0, i.jsx)("span", {
                                        className: (0, f.Z)("text-xxs mt-1", q || y ? "text-primary font-medium" : "text-muted-foreground"),
                                        children: "Pro"
                                    }), "Pro" === a && (0, i.jsx)("span", {
                                        className: "absolute inset-0 bg-primary/5 animate-ripple"
                                    })]
                                })
                            }), (0, i.jsx)(Z.vX, {
                                asChild: !0,
                                onClick: e => {
                                    var t;
                                    if (K("Discord"), !v || !F) {
                                        e.preventDefault();
                                        return
                                    }
                                    if (U) {
                                        e.preventDefault(), w(!0);
                                        return
                                    }
                                    R.co.trackDiscordPaywallTriggered({
                                        source: "discord",
                                        featureName: "Discord Access",
                                        ...(0, R.cz)({
                                            isSignedIn: I,
                                            plan: null == _ ? void 0 : null === (t = _.publicMetadata) || void 0 === t ? void 0 : t.plan,
                                            isPwa: er(),
                                            isWebView: "undefined" != typeof navigator && navigator.userAgent.includes("PWAShell")
                                        })
                                    })
                                },
                                featureName: "Discord Access",
                                title: "Unlock Discord Access",
                                description: "Upgrade to join the private PickFinder Discord and get the member role on your linked Discord account.",
                                benefits: D.vR.discord,
                                source: "discord",
                                children: (0, i.jsxs)("button", {
                                    type: "button",
                                    className: (0, f.Z)("relative flex flex-col items-center justify-center flex-1 h-full pt-1", "overflow-hidden"),
                                    children: [(0, i.jsx)("div", {
                                        className: "relative",
                                        children: (0, i.jsx)("div", {
                                            className: "relative z-10",
                                            children: (0, i.jsx)(z, {
                                                size: 20,
                                                className: "text-blue-400 drop-shadow-[0_0_3px_rgba(59,130,246,0.7)]"
                                            })
                                        })
                                    }), (0, i.jsx)("span", {
                                        className: "text-xxs mt-1 text-blue-400 font-medium",
                                        children: "Discord"
                                    }), "Discord" === a && (0, i.jsx)("span", {
                                        className: "absolute inset-0 bg-blue-500/10 animate-ripple"
                                    })]
                                })
                            })]
                        })
                    }), (0, i.jsx)(S.f, {
                        open: b,
                        onOpenChange: w
                    })]
                })
            }
        }
    }
]);