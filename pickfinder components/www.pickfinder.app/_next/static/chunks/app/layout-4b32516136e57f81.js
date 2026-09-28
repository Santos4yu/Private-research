(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [3185], {
        62456: function() {},
        41868: function(e, r, t) {
            Promise.resolve().then(t.bind(t, 14885)), Promise.resolve().then(t.bind(t, 66819)), Promise.resolve().then(t.bind(t, 53758)), Promise.resolve().then(t.bind(t, 75218)), Promise.resolve().then(t.bind(t, 69948)), Promise.resolve().then(t.bind(t, 32567)), Promise.resolve().then(t.t.bind(t, 97926, 23)), Promise.resolve().then(t.t.bind(t, 13010, 23)), Promise.resolve().then(t.bind(t, 28413)), Promise.resolve().then(t.bind(t, 47061)), Promise.resolve().then(t.bind(t, 13123)), Promise.resolve().then(t.bind(t, 34772)), Promise.resolve().then(t.bind(t, 59160)), Promise.resolve().then(t.t.bind(t, 98496, 23)), Promise.resolve().then(t.t.bind(t, 25567, 23))
        },
        28413: function(e, r, t) {
            "use strict";
            t.d(r, {
                default: function() {
                    return o
                }
            });
            var n = t(55185);
            let i = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

            function o() {
                return (0, n.useEffect)(() => {
                    try {
                        let e = new URLSearchParams(window.location.search),
                            r = {};
                        for (let t of i) {
                            let n = e.get(t);
                            n && (r[t] = n)
                        }
                        if (0 === Object.keys(r).length) return;
                        let t = "https:" === window.location.protocol ? "; secure" : "";
                        document.cookie = "".concat("pf_attr", "=").concat(encodeURIComponent(JSON.stringify(r))) + "; path=/; max-age=".concat(604800, "; samesite=lax").concat(t)
                    } catch (e) {}
                }, []), null
            }
        },
        47061: function(e, r, t) {
            "use strict";
            var n = t(10131),
                i = t(57520);
            r.default = e => {
                let {
                    children: r
                } = e;
                return (0, n.jsxs)(n.Fragment, {
                    children: [r, (0, n.jsx)(i.Cd, {
                        height: "2px",
                        options: {
                            showSpinner: !1
                        },
                        shallowRouting: !0,
                        color: "#3b82f6"
                    })]
                })
            }
        },
        13123: function(e, r, t) {
            "use strict";
            t.d(r, {
                Toaster: function() {
                    return l
                }
            });
            var n = t(10131),
                i = t(72293),
                o = t(7357);
            let l = e => {
                let { ...r
                } = e, {
                    theme: t = "system"
                } = (0, i.F)();
                return (0, n.jsx)(o.x7, {
                    theme: t,
                    className: "toaster group",
                    position: "top-center",
                    toastOptions: {
                        duration: 2e3,
                        classNames: {
                            toast: "group toast group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-card-bg/95 group-[.toaster]:to-card-bg/85 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-input-border group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-sm group-[.toaster]:rounded-xl",
                            description: "group-[.toast]:text-muted-foreground group-[.toast]:opacity-90",
                            actionButton: "group-[.toast]:bg-button group-[.toast]:text-primary-foreground group-[.toast]:hover:brightness-90",
                            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80",
                            success: "group-[.toaster]:border-green-500/30 group-[.toaster]:text-green-400 group-[.toaster]:shadow-green-500/10 group-[.toaster]:ring-1 group-[.toaster]:ring-green-500/20",
                            error: "group-[.toaster]:border-red-500/30 group-[.toaster]:text-red-400 group-[.toaster]:shadow-red-500/10 group-[.toaster]:ring-1 group-[.toaster]:ring-red-500/20"
                        }
                    },
                    ...r
                })
            }
        },
        28876: function(e, r, t) {
            "use strict";
            t.d(r, {
                AM: function() {
                    return v
                },
                IL: function() {
                    return i
                },
                MP: function() {
                    return o
                },
                QS: function() {
                    return m
                },
                Vf: function() {
                    return a
                },
                gT: function() {
                    return l
                },
                nt: function() {
                    return d
                },
                qH: function() {
                    return f
                },
                vR: function() {
                    return u
                },
                y1: function() {
                    return s
                }
            });
            let n = new Set(["User", "Admin", "Friend"]),
                i = "/purchase",
                o = "/upgrade",
                l = !0,
                a = 3,
                u = {
                    default: [],
                    props: [],
                    discrepancies: [],
                    popular: [],
                    altLines: [],
                    playerSearch: [],
                    playerPages: [],
                    pickBuilder: [],
                    discord: [],
                    pro: ["Arbitrage", "Middles", "EV+ board"]
                },
                s = u.default;

            function d(e) {
                return "string" == typeof e && n.has(e)
            }

            function c(e) {
                let r = null == e ? void 0 : e.plan;
                return "string" == typeof r && r.trim() ? r : "None"
            }

            function p(e) {
                return "Admin" === e || "Friend" === e
            }

            function g(e) {
                if ("string" != typeof e || !e) return null;
                let r = new Date(e);
                return Number.isNaN(r.getTime()) ? null : r
            }

            function m(e) {
                let r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    t = c(e);
                return !!p(t) || !!d(t) && ((null == e ? void 0 : e.tier) === "pro" || function(e, r) {
                    let t = g(null == e ? void 0 : e.proTrialEndsAt);
                    return null !== t && t.getTime() > r
                }(e, r))
            }

            function f(e) {
                let r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    t = c(e),
                    n = d(t),
                    i = p(t),
                    o = g(null == e ? void 0 : e.proTrialEndsAt),
                    l = null !== o && o.getTime() > r,
                    a = (null == e ? void 0 : e.tier) === "pro",
                    u = m(e, r),
                    s = (null == e ? void 0 : e.proTrialProvider) === "stripe" || (null == e ? void 0 : e.proTrialProvider) === "clerk" ? e.proTrialProvider : null,
                    f = (null == e ? void 0 : e.billingProvider) === "stripe" || (null == e ? void 0 : e.billingProvider) === "revenuecat" || (null == e ? void 0 : e.billingProvider) === "both" || (null == e ? void 0 : e.billingProvider) === "none" ? e.billingProvider : null,
                    v = l ? Math.max(1, Math.ceil((o.getTime() - r) / 864e5)) : 0;
                return {
                    plan: t,
                    tier: u ? "pro" : "premium",
                    hasPaid: n,
                    hasPro: u,
                    isTrial: n && !i && l,
                    trialEndsAt: o,
                    trialDaysLeft: v,
                    isTrialEligible: "User" === c(e) && (null == e ? void 0 : e.tier) !== "pro" && (null == e ? void 0 : e.proTrialUsed) !== !0,
                    trialUsed: (null == e ? void 0 : e.proTrialUsed) === !0,
                    trialProvider: s,
                    trialOptedOut: (null == e ? void 0 : e.proTrialOptedOut) === !0,
                    billingProvider: f,
                    isComped: i || a && !l
                }
            }

            function v(e) {
                let r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Date.now(),
                    t = f(e, r);
                return "Friend" === t.plan ? "Friends & Family" : "Admin" === t.plan ? "Admin" : t.hasPaid ? t.isTrial && !t.isComped ? "Pro trial" : t.hasPro ? "Pro" : "Premium" : "None" === t.plan ? "Free" : t.plan
            }
        },
        34772: function(e, r, t) {
            "use strict";
            t.d(r, {
                PickFinderAnalyticsProvider: function() {
                    return s
                },
                co: function() {
                    return u
                },
                cz: function() {
                    return l
                },
                Js: function() {
                    return o
                }
            });
            var n = t(10131),
                i = t(28876);

            function o(e) {
                return "string" == typeof e && e.trim() ? e : "None"
            }

            function l(e) {
                let {
                    isSignedIn: r,
                    plan: t,
                    metadata: n,
                    isPwa: l,
                    isWebView: a
                } = e, u = o(null != t ? t : null == n ? void 0 : n.plan), s = !!a, d = !!(l || s || window.matchMedia("(display-mode: standalone)").matches || document.referrer.includes("android-app://") || navigator.userAgent.includes("PWAShell")), c = (0, i.qH)(null != n ? n : {
                    plan: u
                });
                return {
                    is_signed_in: !!r,
                    plan: u,
                    is_paid: (0, i.nt)(u),
                    tier: c.tier,
                    is_pro: c.hasPro,
                    pro_trial_active: c.isTrial,
                    is_pwa: d,
                    is_webview: s
                }
            }

            function a(e, r) {}
            let u = {
                capture: a,
                identifyUser: function(e) {},
                resetUser: function() {},
                trackFreemiumPropsViewed: e => a("freemium_props_viewed", e),
                trackFreemiumPopularViewed: e => a("freemium_popular_viewed", e),
                trackFreemiumDiscrepanciesViewed: e => a("freemium_discrepancies_viewed", e),
                trackFreemiumPlayerPreviewViewed: e => a("freemium_player_preview_viewed", e),
                trackPaywallOpened: e => a("paywall_opened", e),
                trackPaywallClosed: e => a("paywall_closed", e),
                trackPaywallKeepPreviewClicked: e => a("paywall_keep_preview_clicked", e),
                trackPaywallSignInClicked: e => a("paywall_sign_in_clicked", e),
                trackPaywallPlanSelected: e => a("paywall_plan_selected", e),
                trackPaywallCheckoutClicked: e => a("paywall_checkout_clicked", e),
                trackPaywallNativePaymentClicked: e => a("paywall_native_payment_clicked", e),
                trackFavoritePaywallTriggered: e => a("favorite_paywall_triggered", e),
                trackPlayerPageLocked: e => a("player_page_locked", e),
                trackLockedFilterClicked: e => a("locked_filter_clicked", e),
                trackDiscordPaywallTriggered: e => a("discord_paywall_triggered", e),
                trackPickBuilderPaywallTriggered: e => a("pick_builder_paywall_triggered", e),
                trackClerkSignInStarted: e => a("clerk_sign_in_started", e),
                trackCheckoutClicked: e => a("checkout_clicked", e),
                trackNativeRevenueCatPaywallTriggered: e => a("native_revenuecat_paywall_triggered", e),
                trackLandingPricingPlanClicked: e => a("landing_pricing_plan_clicked", e)
            };

            function s(e) {
                let {
                    children: r
                } = e;
                return (0, n.jsx)(n.Fragment, {
                    children: r
                })
            }
        },
        59160: function(e, r, t) {
            "use strict";
            t.d(r, {
                B: function() {
                    return l
                },
                WebViewProvider: function() {
                    return a
                }
            });
            var n = t(10131),
                i = t(55185);
            let o = (0, i.createContext)(void 0),
                l = () => {
                    let e = (0, i.useContext)(o);
                    if (void 0 === e) throw Error("useWebView must be used within a WebViewProvider");
                    return e
                },
                a = e => {
                    let {
                        isWebViewApp: r,
                        children: t
                    } = e, [l, a] = (0, i.useState)(!1);
                    return (0, i.useEffect)(() => {
                        void 0 === r && a(navigator.userAgent.includes("PWAShell"))
                    }, [r]), (0, n.jsx)(o.Provider, {
                        value: {
                            isWebViewApp: null != r ? r : l
                        },
                        children: t
                    })
                }
        },
        98496: function() {},
        25567: function() {}
    },
    function(e) {
        e.O(0, [2822, 3183, 139, 8819, 9596, 3209, 7926, 6741, 4643, 5552, 1355, 1744], function() {
            return e(e.s = 41868)
        }), _N_E = e.O()
    }
]);