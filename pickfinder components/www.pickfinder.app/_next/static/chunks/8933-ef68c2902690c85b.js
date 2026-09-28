"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [8933], {
        229: function(e, t, r) {
            r.d(t, {
                Xn: function() {
                    return x
                },
                bs: function() {
                    return m
                },
                iG: function() {
                    return u
                }
            });
            var l = r(10131),
                i = r(55185),
                n = r(69237),
                a = r(59160);
            let s = ["pointerdown", "mousedown", "touchstart", "click"],
                c = {
                    capture: !0,
                    passive: !1
                },
                o = 0,
                d = {
                    elements: {
                        modalBackdrop: {
                            touchAction: "none",
                            overscrollBehavior: "contain"
                        },
                        modalContent: {
                            pointerEvents: "auto"
                        }
                    }
                };

            function u(e) {
                let {
                    isWebViewApp: t,
                    redirectUrl: r
                } = e, l = null != r ? r : window.location.href;
                return {
                    appearance: d,
                    forceRedirectUrl: l,
                    fallbackRedirectUrl: l,
                    signUpForceRedirectUrl: l,
                    signUpFallbackRedirectUrl: l,
                    withSignUp: !0,
                    oauthFlow: t ? "redirect" : "auto"
                }
            }

            function p(e) {
                var t;
                let r = e.target;
                if (!(r instanceof Node)) return;
                let l = r instanceof Element ? r : r.parentElement,
                    i = null === (t = document.querySelector('.cl-signIn-root, [class*="cl-signIn-root"]')) || void 0 === t ? void 0 : t.closest('.cl-modalContent, [class*="cl-modalContent"]'),
                    n = document.querySelector('.cl-modalBackdrop, [class*="cl-modalBackdrop"]');
                !(!i || !n || i.contains(r)) && (null != l && l.closest('.cl-menu, .cl-menuItem, .cl-popover, .cl-dropdown, [class*="cl-menu"], [class*="cl-popover"], [class*="cl-dropdown"], [data-localization-key], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"]') || (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation()))
            }

            function m() {
                (0, i.useEffect)(() => (0 === o && s.forEach(e => {
                    document.addEventListener(e, p, c)
                }), o += 1, () => {
                    0 === (o = Math.max(0, o - 1)) && s.forEach(e => {
                        document.removeEventListener(e, p, c)
                    })
                }), [])
            }

            function x(e) {
                let {
                    children: t,
                    redirectUrl: r
                } = e, {
                    isWebViewApp: i
                } = (0, a.B)(), s = u({
                    isWebViewApp: i,
                    redirectUrl: r
                });
                return m(), (0, l.jsx)(n.$d, {
                    mode: "modal",
                    ...s,
                    children: t
                })
            }
        },
        8933: function(e, t, r) {
            r.d(t, {
                Ei: function() {
                    return E
                },
                Mz: function() {
                    return F
                },
                vX: function() {
                    return S
                }
            });
            var l = r(10131),
                i = r(41915),
                n = r(33658),
                a = r(55185),
                s = r(69237),
                c = r(59564),
                o = r(40122),
                d = r(91e3),
                u = r(69687),
                p = r(63855),
                m = r(6094),
                x = r(229),
                f = r(34772),
                h = r(28876),
                g = r(36839),
                w = r(59160),
                b = r(58685);
            let k = [{
                    id: "premium",
                    label: "Premium",
                    blurb: "Full board, player pages, filters & Discord"
                }, ...h.gT ? [{
                    id: "pro",
                    label: "Pro",
                    blurb: "Premium + Arbitrage, Middles & EV+"
                }] : []],
                v = {
                    title: "Unlock PickFinder Premium",
                    description: "Every prop across every book, full filters, player pages, and our premium Discord with admin picks."
                },
                _ = {
                    title: "Unlock PickFinder Pro",
                    description: "Arbitrage, Middles and EV+ on top of everything in Premium.",
                    benefits: h.vR.pro
                },
                y = "pickfinder:pending-upgrade-flow";

            function P(e) {
                let {
                    featureName: t,
                    source: r
                } = e;
                return [null != r ? r : "unknown", null != t ? t : "PickFinder"].join(":")
            }

            function j(e) {
                window.sessionStorage.setItem(y, JSON.stringify({
                    key: e,
                    createdAt: Date.now()
                }))
            }

            function N(e) {
                try {
                    let t = window.sessionStorage.getItem(y);
                    if (!t) return !1;
                    let r = JSON.parse(t),
                        l = "number" == typeof r.createdAt && Date.now() - r.createdAt < 18e5,
                        i = r.key === e && l;
                    return (i || !l) && window.sessionStorage.removeItem(y), i
                } catch (e) {
                    return window.sessionStorage.removeItem(y), !1
                }
            }

            function C(e) {
                var t, r;
                let {
                    userId: l,
                    plan: i,
                    properties: n
                } = e, a = null === (r = window.webkit) || void 0 === r ? void 0 : null === (t = r.messageHandlers) || void 0 === t ? void 0 : t.userLogin;
                return a ? (f.co.trackPaywallNativePaymentClicked(n), f.co.trackNativeRevenueCatPaywallTriggered({ ...n,
                    payment_surface: "native_revenuecat"
                }), a.postMessage({
                    id: l,
                    plan: i
                }), !0) : (console.warn("[UpgradeDialog] Native paywall handler is unavailable."), !1)
            }

            function F(e) {
                var t;
                let {
                    onDismiss: r,
                    onKeepPreview: i,
                    featureName: n = "PickFinder",
                    title: c,
                    description: o,
                    benefits: d,
                    upgradeHref: u,
                    keepPreviewLabel: p,
                    signedOutBehavior: m = "sign-in-first",
                    source: g,
                    defaultTier: b,
                    defaultInterval: k
                } = e, {
                    openSignIn: v
                } = (0, s.ll)(), {
                    user: _,
                    isLoaded: y,
                    isSignedIn: F
                } = (0, s.aF)(), {
                    isWebViewApp: S
                } = (0, w.B)(), [I, U] = (0, a.useState)(!1), [A, B] = (0, a.useState)(!1), D = (0, f.Js)(null == _ ? void 0 : null === (t = _.publicMetadata) || void 0 === t ? void 0 : t.plan), M = (0, h.nt)(D), T = null != c ? c : "Unlock ".concat(n), z = (0, a.useMemo)(() => P({
                    featureName: n,
                    title: T,
                    source: g
                }), [n, T, g]), R = (0, a.useMemo)(() => ({
                    featureName: n,
                    title: T,
                    source: g,
                    ...(0, f.cz)({
                        isSignedIn: F,
                        plan: D,
                        isPwa: S,
                        isWebView: S
                    })
                }), [n, F, S, T, g, D]);
                (0, x.bs)();
                let V = (0, a.useCallback)(() => {
                    if (y) {
                        if (!F) {
                            if ("paywall-first" === m) {
                                U(!0);
                                return
                            }
                            B(!0), j(z), f.co.trackPaywallSignInClicked(R), v((0, x.iG)({
                                isWebViewApp: S
                            }));
                            return
                        }
                        S && !M && _ && C({
                            userId: _.id,
                            plan: D,
                            properties: R
                        }) || U(!0)
                    }
                }, [y, F, S, v, z, R, m, _, M, D]);
                return (0, a.useEffect)(() => {
                    y && F && (A || N(z)) && (B(!1), !M) && !(S && _ && C({
                        userId: _.id,
                        plan: D,
                        properties: R
                    })) && U(!0)
                }, [y, F, S, z, A, R, _, M, D]), {
                    open: I,
                    setOpen: U,
                    openUpgradeDialog: V,
                    upgradeDialog: (0, l.jsx)(E, {
                        open: I,
                        onOpenChange: U,
                        onDismiss: r,
                        onKeepPreview: i,
                        featureName: n,
                        title: c,
                        description: o,
                        benefits: d,
                        upgradeHref: u,
                        keepPreviewLabel: p,
                        signedOutBehavior: m,
                        source: g,
                        defaultTier: b,
                        defaultInterval: k
                    })
                }
            }

            function S(e) {
                let {
                    asChild: t = !1,
                    buttonTitle: r,
                    children: i,
                    onClick: a,
                    onDismiss: s,
                    onKeepPreview: c,
                    featureName: o,
                    title: d,
                    description: u,
                    benefits: p,
                    upgradeHref: m,
                    keepPreviewLabel: x,
                    signedOutBehavior: f,
                    source: h,
                    defaultTier: g,
                    defaultInterval: w,
                    type: b = "button",
                    ...k
                } = e, v = t ? n.g7 : "button", {
                    openUpgradeDialog: _,
                    upgradeDialog: y
                } = F({
                    onDismiss: s,
                    onKeepPreview: c,
                    featureName: o,
                    title: d,
                    description: u,
                    benefits: p,
                    upgradeHref: m,
                    keepPreviewLabel: x,
                    signedOutBehavior: f,
                    source: h,
                    defaultTier: g,
                    defaultInterval: w
                });
                return (0, l.jsxs)(l.Fragment, {
                    children: [(0, l.jsx)(v, { ...k,
                        type: b,
                        title: r,
                        onClick: e => {
                            null == a || a(e), e.defaultPrevented || _()
                        },
                        children: i
                    }), y]
                })
            }

            function E(e) {
                var t;
                let {
                    open: r,
                    onOpenChange: n,
                    onDismiss: y,
                    onKeepPreview: F,
                    featureName: S = "PickFinder",
                    title: E,
                    description: I,
                    benefits: U = h.y1,
                    upgradeHref: A = h.IL,
                    keepPreviewLabel: B = "Keep Previewing",
                    signedOutBehavior: D = "sign-in-first",
                    source: M,
                    defaultTier: T,
                    defaultInterval: z
                } = e, {
                    signOut: R,
                    openSignIn: V
                } = (0, s.ll)(), {
                    user: L,
                    isLoaded: O,
                    isSignedIn: Z
                } = (0, s.aF)(), {
                    isWebViewApp: J
                } = (0, w.B)(), K = "pro" === T && h.gT ? "pro" : "premium", q = null != z ? z : "monthly", [G, H] = (0, a.useState)(K), [W, X] = (0, a.useState)(q);
                (0, a.useEffect)(() => {
                    r && (H(K), X(q))
                }, [r, K, q]);
                let [Q, $] = (0, a.useState)(!1), [Y, ee] = (0, a.useState)(!1), et = (0, a.useRef)(!1), er = (0, a.useRef)(!1), el = (0, a.useRef)(!1), ei = "PickFinder" === S, en = null != E ? E : ei ? v.title : "Unlock ".concat(S), ea = null != I ? I : ei ? v.description : "Upgrade to access ".concat(S, ", full filters, player pages, and our premium Discord with admin picks."), es = "pro" === G, ec = es ? _.title : en, eo = es ? _.description : ea, ed = es ? _.benefits : U, eu = (0, f.Js)(null == L ? void 0 : null === (t = L.publicMetadata) || void 0 === t ? void 0 : t.plan), ep = (0, h.nt)(eu), em = "paywall-first" === D && O && !Z, ex = r && O && (!!Z || em), ef = J && Z && !ep, eh = ef ? "Continue to payment in the PickFinder app to unlock the full board." : em ? "Sign in or create an account to choose a plan and unlock the full board." : null, eg = (0, a.useMemo)(() => P({
                    featureName: S,
                    title: ec,
                    source: M
                }), [S, ec, M]), ew = (0, a.useMemo)(() => ({
                    featureName: S,
                    title: ec,
                    source: M,
                    selected_plan: W,
                    selected_tier: G,
                    ...(0, f.cz)({
                        isSignedIn: Z,
                        plan: eu,
                        isPwa: J,
                        isWebView: J
                    })
                }), [S, Z, J, ec, W, G, M, eu]);
                (0, x.bs)(), (0, a.useEffect)(() => {
                    if (!r) {
                        er.current = !1, el.current = !1;
                        return
                    }!O || Z || er.current || "paywall-first" === D || (er.current = !0, j(eg), f.co.trackPaywallSignInClicked(ew), V((0, x.iG)({
                        isWebViewApp: J
                    })), n(!1))
                }, [O, Z, J, n, r, V, ew, eg, D]), (0, a.useEffect)(() => {
                    O && Z && !r && N(eg) && !ep && !(ef && L && C({
                        userId: L.id,
                        plan: eu,
                        properties: ew
                    })) && n(!0)
                }, [O, Z, n, r, ew, eg, ef, L, ep, eu]), (0, a.useEffect)(() => {
                    if (r && ef && L && !el.current) {
                        if (el.current = !0, C({
                                userId: L.id,
                                plan: eu,
                                properties: ew
                            })) {
                            n(!1);
                            return
                        }
                        el.current = !1
                    }
                }, [n, r, ew, ef, L, eu]), (0, a.useEffect)(() => {
                    ex || $(!1)
                }, [ex]), (0, a.useEffect)(() => {
                    ex && !et.current && f.co.trackPaywallOpened(ew), !ex && et.current && f.co.trackPaywallClosed(ew), et.current = ex
                }, [ex, ew]);
                let eb = async () => {
                    try {
                        ee(!0), await R({
                            redirectUrl: "/sign-in"
                        })
                    } catch (e) {
                        console.error("Error signing out:", e), ee(!1)
                    }
                };
                return O && (Z || "paywall-first" === D) ? (0, l.jsx)(p.Vq, {
                    open: ex,
                    onOpenChange: e => {
                        n(e), e || null == y || y()
                    },
                    children: (0, l.jsx)(p.cZ, {
                        className: "border-0 bg-transparent p-0 text-slate-200 shadow-none sm:max-w-[28rem]",
                        children: (0, l.jsxs)("div", {
                            className: "relative isolate w-full overflow-hidden rounded-xl shadow-[0_5px_15px_0_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(0,0,0,0.20),0_0_0_1px_rgba(255,255,255,0.07)]",
                            children: [(0, l.jsxs)("div", {
                                className: "relative z-10 -mx-px -mt-px flex flex-col items-stretch justify-center gap-5 rounded-lg border-0 bg-[#030712] px-6 py-7 text-center shadow-[0_0_2px_0_rgba(0,0,0,0.08),0_1px_2px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(255,255,255,0.03)] sm:px-7",
                                children: [(0, l.jsx)("div", {
                                    className: "mx-auto flex h-12 w-12 items-center justify-center",
                                    children: (0, l.jsx)(m.Z, {
                                        width: 48,
                                        height: 48,
                                        className: "drop-shadow-[0_10px_30px_rgba(52,97,255,0.5)]"
                                    })
                                }), (0, l.jsxs)("div", {
                                    className: "flex flex-col gap-2",
                                    children: [(0, l.jsx)("h2", {
                                        className: "text-lg font-bold text-white",
                                        children: ec
                                    }), (0, l.jsx)("p", {
                                        className: "text-sm leading-5 text-gray-500",
                                        children: eo
                                    }), eh ? (0, l.jsx)("p", {
                                        className: "text-xs leading-5 text-gray-400",
                                        children: eh
                                    }) : null]
                                }), ed.length > 0 && (0, l.jsx)("div", {
                                    className: (0, b.cn)("grid gap-2 text-left", 3 === ed.length ? "grid-cols-3" : "grid-cols-2"),
                                    children: ed.slice(0, 4).map(e => (0, l.jsxs)("div", {
                                        className: "flex min-w-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-300",
                                        children: [(0, l.jsx)(c.Z, {
                                            className: "h-3.5 w-3.5 shrink-0 text-blue-300"
                                        }), (0, l.jsx)("span", {
                                            className: "truncate",
                                            children: e
                                        })]
                                    }, e))
                                }), (0, l.jsxs)("div", {
                                    className: "flex flex-col gap-2",
                                    children: [em ? (0, l.jsx)(u.z, {
                                        variant: "blue",
                                        className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                                        onClick: () => {
                                            j(eg), f.co.trackPaywallSignInClicked(ew), V((0, x.iG)({
                                                isWebViewApp: J
                                            })), n(!1)
                                        },
                                        children: "Sign in to unlock"
                                    }) : ef ? (0, l.jsx)(u.z, {
                                        variant: "blue",
                                        className: "h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                                        onClick: () => {
                                            L && Z && C({
                                                userId: L.id,
                                                plan: eu,
                                                properties: ew
                                            }) && n(!1)
                                        },
                                        disabled: !O,
                                        children: O ? "Continue to payment" : "Loading account..."
                                    }) : (0, l.jsxs)("div", {
                                        className: "flex flex-col gap-2",
                                        children: [(0, l.jsx)("div", {
                                            role: "radiogroup",
                                            "aria-label": "Billing interval",
                                            className: "grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1",
                                            children: g.K.map(e => {
                                                let t = W === e,
                                                    r = (0, g.tT)(G, e);
                                                return (0, l.jsxs)("button", {
                                                    type: "button",
                                                    role: "radio",
                                                    "aria-checked": t,
                                                    onMouseDown: e => e.preventDefault(),
                                                    onClick: () => {
                                                        X(e), f.co.trackPaywallPlanSelected({ ...ew,
                                                            selected_plan: e,
                                                            selected_tier: G
                                                        })
                                                    },
                                                    className: (0, b.cn)("flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors !outline-none !ring-0 focus-visible:!outline-none", t ? "bg-[#3461FF] text-white" : "text-[#AFB2C0] hover:text-white"),
                                                    children: [g.V0[e].label, r > 0 ? (0, l.jsxs)("span", {
                                                        className: (0, b.cn)("rounded px-1 py-px text-[9px] font-semibold tabular-nums", t ? "bg-white/20 text-white" : "bg-[#3461FF]/20 text-[#8ab0ff]"),
                                                        children: ["-", r, "%"]
                                                    }) : null]
                                                }, e)
                                            })
                                        }), (0, l.jsx)("div", {
                                            className: "flex flex-col gap-2",
                                            role: "radiogroup",
                                            "aria-label": "Choose a plan",
                                            children: k.map(e => {
                                                let t = G === e.id,
                                                    r = g.Qu[e.id][W];
                                                return (0, l.jsxs)("button", {
                                                    type: "button",
                                                    role: "radio",
                                                    "aria-checked": t,
                                                    onMouseDown: e => e.preventDefault(),
                                                    onClick: () => {
                                                        H(e.id), f.co.trackPaywallPlanSelected({ ...ew,
                                                            selected_plan: W,
                                                            selected_tier: e.id
                                                        })
                                                    },
                                                    className: (0, b.cn)("group/plan relative flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all !outline-none !ring-0 !ring-offset-0 focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0", t ? "border-[#3461FF]/70 bg-[#3461FF]/14 shadow-[0_10px_32px_-20px_rgba(52,97,255,0.85)]" : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.055]"),
                                                    children: [(0, l.jsxs)("span", {
                                                        className: "min-w-0 flex-1",
                                                        children: [(0, l.jsxs)("span", {
                                                            className: "flex min-w-0 items-center gap-2",
                                                            children: [(0, l.jsx)("span", {
                                                                className: "truncate text-sm font-semibold text-[#d8dceb]",
                                                                children: e.label
                                                            }), "pro" === e.id ? (0, l.jsx)("span", {
                                                                className: "shrink-0 rounded-md border border-[#3461FF]/40 bg-[#3461FF]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#8ab0ff]",
                                                                children: "New"
                                                            }) : null]
                                                        }), (0, l.jsx)("span", {
                                                            className: "mt-1 block truncate text-xs text-[#8d93aa]",
                                                            children: e.blurb
                                                        })]
                                                    }), (0, l.jsxs)("span", {
                                                        className: "shrink-0 text-right",
                                                        children: [r.originalPrice ? (0, l.jsx)("span", {
                                                            className: "mr-1.5 text-xs tabular-nums text-[#6F7280] line-through",
                                                            children: (0, g.T4)(r.originalPrice)
                                                        }) : null, (0, l.jsx)("span", {
                                                            className: "text-lg font-semibold tabular-nums text-white",
                                                            children: (0, g.T4)(r.price)
                                                        }), (0, l.jsx)("span", {
                                                            className: "ml-1 text-[11px] text-[#AFB2C0]",
                                                            children: g.V0[W].shortSuffix
                                                        })]
                                                    }), (0, l.jsx)("span", {
                                                        className: (0, b.cn)("ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors", t ? "border-[#6f8dff] bg-[#3461FF] text-white" : "border-white/[0.14] bg-transparent text-transparent"),
                                                        children: (0, l.jsx)(c.Z, {
                                                            className: "h-3.5 w-3.5"
                                                        })
                                                    })]
                                                }, e.id)
                                            })
                                        }), (0, l.jsx)(u.z, {
                                            asChild: !0,
                                            variant: "blue",
                                            className: "mt-1 h-12 rounded-2xl border-[#3461FF]/40 text-[15px] text-white",
                                            children: (0, l.jsx)(i.default, {
                                                href: ((e, t) => {
                                                    let r = (0, g.BP)(e, t);
                                                    if (!r) return A;
                                                    let l = new URLSearchParams({
                                                        plan: r
                                                    });
                                                    return M && l.set("source", M), window.tolt_referral && l.set("ref", window.tolt_referral), "/purchase?".concat(l.toString())
                                                })(G, W),
                                                onClick: () => {
                                                    f.co.trackPaywallCheckoutClicked({ ...ew,
                                                        selected_plan: W,
                                                        selected_tier: G
                                                    }), f.co.trackCheckoutClicked({ ...ew,
                                                        selected_plan: W,
                                                        selected_tier: G,
                                                        payment_surface: "web_checkout"
                                                    }), n(!1)
                                                },
                                                children: "Check out"
                                            })
                                        })]
                                    }), (0, l.jsx)(u.z, {
                                        variant: "outline",
                                        className: "h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium leading-none text-white shadow-none hover:bg-white/[0.08] hover:text-white",
                                        onClick: () => {
                                            if (f.co.trackPaywallKeepPreviewClicked(ew), F) {
                                                F();
                                                return
                                            }
                                            n(!1)
                                        },
                                        children: B
                                    }), Z && !ep ? (0, l.jsxs)("button", {
                                        type: "button",
                                        onClick: () => $(!0),
                                        className: "text-center text-xs font-medium text-[#8d93aa] transition-colors hover:text-white",
                                        children: ["Already have PickFinder? ", (0, l.jsx)("span", {
                                            className: "text-[#9eb2ff]",
                                            children: "Switch account"
                                        })]
                                    }) : null]
                                })]
                            }), Q ? (0, l.jsx)("div", {
                                className: "absolute inset-0 z-20 flex items-center justify-center bg-[#02040c]/72 px-4 backdrop-blur-sm",
                                children: (0, l.jsxs)("div", {
                                    className: "w-full max-w-[380px] rounded-3xl border border-white/[0.08] bg-[#050917] p-4 shadow-[0_24px_70px_-32px_rgba(52,97,255,0.9)]",
                                    children: [(0, l.jsxs)("div", {
                                        className: "flex items-start gap-3",
                                        children: [(0, l.jsxs)("div", {
                                            className: "min-w-0 flex-1",
                                            children: [(0, l.jsx)("h3", {
                                                className: "text-left text-lg font-semibold leading-6 text-white",
                                                children: "Already subscribed?"
                                            }), (0, l.jsx)("p", {
                                                className: "mt-2 text-left text-sm leading-5 text-[#AFB2C0]",
                                                children: "If you already have PickFinder and are seeing this modal, you may be signed into the wrong account. Sign out, then sign in with the email you used to purchase."
                                            })]
                                        }), (0, l.jsx)("button", {
                                            type: "button",
                                            onClick: () => $(!1),
                                            className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#AFB2C0] transition-colors hover:bg-white/[0.08] hover:text-white",
                                            "aria-label": "Close account help",
                                            children: (0, l.jsx)(o.Z, {
                                                className: "h-4 w-4"
                                            })
                                        })]
                                    }), (0, l.jsx)("div", {
                                        className: "mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3",
                                        children: (0, l.jsxs)("p", {
                                            className: "text-left text-sm leading-5 text-[#d8dceb]",
                                            children: ["Still having issues? Email", " ", (0, l.jsx)("a", {
                                                className: "font-semibold text-[#9eb2ff]",
                                                href: "mailto:support@pickfinder.app",
                                                children: "support@pickfinder.app"
                                            }), "."]
                                        })
                                    }), (0, l.jsxs)("div", {
                                        className: "mt-4 flex gap-2",
                                        children: [(0, l.jsxs)("button", {
                                            type: "button",
                                            onClick: eb,
                                            disabled: Y,
                                            className: "inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-[#3461FF]/40 bg-gradient-to-t from-blue-800 to-blue-600 px-4 text-sm font-medium text-white transition-all hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-70",
                                            children: [(0, l.jsx)(d.Z, {
                                                className: "mr-2 h-4 w-4"
                                            }), Y ? "Signing out..." : "Sign out"]
                                        }), (0, l.jsx)("a", {
                                            href: "mailto:support@pickfinder.app",
                                            className: "inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]",
                                            children: "Email support"
                                        })]
                                    })]
                                })
                            }) : null]
                        })
                    })
                }) : null
            }
        },
        34772: function(e, t, r) {
            r.d(t, {
                PickFinderAnalyticsProvider: function() {
                    return o
                },
                co: function() {
                    return c
                },
                cz: function() {
                    return a
                },
                Js: function() {
                    return n
                }
            });
            var l = r(10131),
                i = r(28876);

            function n(e) {
                return "string" == typeof e && e.trim() ? e : "None"
            }

            function a(e) {
                let {
                    isSignedIn: t,
                    plan: r,
                    metadata: l,
                    isPwa: a,
                    isWebView: s
                } = e, c = n(null != r ? r : null == l ? void 0 : l.plan), o = !!s, d = !!(a || o || window.matchMedia("(display-mode: standalone)").matches || document.referrer.includes("android-app://") || navigator.userAgent.includes("PWAShell")), u = (0, i.qH)(null != l ? l : {
                    plan: c
                });
                return {
                    is_signed_in: !!t,
                    plan: c,
                    is_paid: (0, i.nt)(c),
                    tier: u.tier,
                    is_pro: u.hasPro,
                    pro_trial_active: u.isTrial,
                    is_pwa: d,
                    is_webview: o
                }
            }

            function s(e, t) {}
            let c = {
                capture: s,
                identifyUser: function(e) {},
                resetUser: function() {},
                trackFreemiumPropsViewed: e => s("freemium_props_viewed", e),
                trackFreemiumPopularViewed: e => s("freemium_popular_viewed", e),
                trackFreemiumDiscrepanciesViewed: e => s("freemium_discrepancies_viewed", e),
                trackFreemiumPlayerPreviewViewed: e => s("freemium_player_preview_viewed", e),
                trackPaywallOpened: e => s("paywall_opened", e),
                trackPaywallClosed: e => s("paywall_closed", e),
                trackPaywallKeepPreviewClicked: e => s("paywall_keep_preview_clicked", e),
                trackPaywallSignInClicked: e => s("paywall_sign_in_clicked", e),
                trackPaywallPlanSelected: e => s("paywall_plan_selected", e),
                trackPaywallCheckoutClicked: e => s("paywall_checkout_clicked", e),
                trackPaywallNativePaymentClicked: e => s("paywall_native_payment_clicked", e),
                trackFavoritePaywallTriggered: e => s("favorite_paywall_triggered", e),
                trackPlayerPageLocked: e => s("player_page_locked", e),
                trackLockedFilterClicked: e => s("locked_filter_clicked", e),
                trackDiscordPaywallTriggered: e => s("discord_paywall_triggered", e),
                trackPickBuilderPaywallTriggered: e => s("pick_builder_paywall_triggered", e),
                trackClerkSignInStarted: e => s("clerk_sign_in_started", e),
                trackCheckoutClicked: e => s("checkout_clicked", e),
                trackNativeRevenueCatPaywallTriggered: e => s("native_revenuecat_paywall_triggered", e),
                trackLandingPricingPlanClicked: e => s("landing_pricing_plan_clicked", e)
            };

            function o(e) {
                let {
                    children: t
                } = e;
                return (0, l.jsx)(l.Fragment, {
                    children: t
                })
            }
        }
    }
]);