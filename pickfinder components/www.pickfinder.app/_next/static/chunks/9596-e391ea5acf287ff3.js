(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [9596], {
        67057: function(e, t, r) {
            "use strict";
            r.r(t);
            var n = r(78149),
                i = {};
            for (var o in n) "default" !== o && (i[o] = (function(e) {
                return n[e]
            }).bind(0, o));
            r.d(t, i)
        },
        72044: function(e, t, r) {
            "use strict";
            var n, i;
            e.exports = (null == (n = r.g.process) ? void 0 : n.env) && "object" == typeof(null == (i = r.g.process) ? void 0 : i.env) ? r.g.process : r(52866)
        },
        52866: function(e) {
            ! function() {
                var t = {
                        229: function(e) {
                            var t, r, n, i = e.exports = {};

                            function o() {
                                throw Error("setTimeout has not been defined")
                            }

                            function s() {
                                throw Error("clearTimeout has not been defined")
                            }

                            function l(e) {
                                if (t === setTimeout) return setTimeout(e, 0);
                                if ((t === o || !t) && setTimeout) return t = setTimeout, setTimeout(e, 0);
                                try {
                                    return t(e, 0)
                                } catch (r) {
                                    try {
                                        return t.call(null, e, 0)
                                    } catch (r) {
                                        return t.call(this, e, 0)
                                    }
                                }
                            }! function() {
                                try {
                                    t = "function" == typeof setTimeout ? setTimeout : o
                                } catch (e) {
                                    t = o
                                }
                                try {
                                    r = "function" == typeof clearTimeout ? clearTimeout : s
                                } catch (e) {
                                    r = s
                                }
                            }();
                            var a = [],
                                u = !1,
                                c = -1;

                            function d() {
                                u && n && (u = !1, n.length ? a = n.concat(a) : c = -1, a.length && p())
                            }

                            function p() {
                                if (!u) {
                                    var e = l(d);
                                    u = !0;
                                    for (var t = a.length; t;) {
                                        for (n = a, a = []; ++c < t;) n && n[c].run();
                                        c = -1, t = a.length
                                    }
                                    n = null, u = !1,
                                        function(e) {
                                            if (r === clearTimeout) return clearTimeout(e);
                                            if ((r === s || !r) && clearTimeout) return r = clearTimeout, clearTimeout(e);
                                            try {
                                                r(e)
                                            } catch (t) {
                                                try {
                                                    return r.call(null, e)
                                                } catch (t) {
                                                    return r.call(this, e)
                                                }
                                            }
                                        }(e)
                                }
                            }

                            function h(e, t) {
                                this.fun = e, this.array = t
                            }

                            function f() {}
                            i.nextTick = function(e) {
                                var t = Array(arguments.length - 1);
                                if (arguments.length > 1)
                                    for (var r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
                                a.push(new h(e, t)), 1 !== a.length || u || l(p)
                            }, h.prototype.run = function() {
                                this.fun.apply(null, this.array)
                            }, i.title = "browser", i.browser = !0, i.env = {}, i.argv = [], i.version = "", i.versions = {}, i.on = f, i.addListener = f, i.once = f, i.off = f, i.removeListener = f, i.removeAllListeners = f, i.emit = f, i.prependListener = f, i.prependOnceListener = f, i.listeners = function(e) {
                                return []
                            }, i.binding = function(e) {
                                throw Error("process.binding is not supported")
                            }, i.cwd = function() {
                                return "/"
                            }, i.chdir = function(e) {
                                throw Error("process.chdir is not supported")
                            }, i.umask = function() {
                                return 0
                            }
                        }
                    },
                    r = {};

                function n(e) {
                    var i = r[e];
                    if (void 0 !== i) return i.exports;
                    var o = r[e] = {
                            exports: {}
                        },
                        s = !0;
                    try {
                        t[e](o, o.exports, n), s = !1
                    } finally {
                        s && delete r[e]
                    }
                    return o.exports
                }
                n.ab = "//";
                var i = n(229);
                e.exports = i
            }()
        },
        21327: function(e, t, r) {
            "use strict";
            var n = r(55185),
                i = "function" == typeof Object.is ? Object.is : function(e, t) {
                    return e === t && (0 !== e || 1 / e == 1 / t) || e != e && t != t
                },
                o = n.useState,
                s = n.useEffect,
                l = n.useLayoutEffect,
                a = n.useDebugValue;

            function u(e) {
                var t = e.getSnapshot;
                e = e.value;
                try {
                    var r = t();
                    return !i(e, r)
                } catch (e) {
                    return !0
                }
            }
            var c = "undefined" == typeof window || void 0 === window.document || void 0 === window.document.createElement ? function(e, t) {
                return t()
            } : function(e, t) {
                var r = t(),
                    n = o({
                        inst: {
                            value: r,
                            getSnapshot: t
                        }
                    }),
                    i = n[0].inst,
                    c = n[1];
                return l(function() {
                    i.value = r, i.getSnapshot = t, u(i) && c({
                        inst: i
                    })
                }, [e, r, t]), s(function() {
                    return u(i) && c({
                        inst: i
                    }), e(function() {
                        u(i) && c({
                            inst: i
                        })
                    })
                }, [e]), a(r), r
            };
            t.useSyncExternalStore = void 0 !== n.useSyncExternalStore ? n.useSyncExternalStore : c
        },
        58413: function(e, t, r) {
            "use strict";
            e.exports = r(21327)
        },
        66517: function(e, t, r) {
            "use strict";
            r.d(t, {
                Vo: function() {
                    return h
                },
                vn: function() {
                    return ei
                },
                n9: function() {
                    return Z
                },
                KA: function() {
                    return H
                },
                a7: function() {
                    return G
                },
                qI: function() {
                    return Y
                },
                iz: function() {
                    return g
                },
                Cv: function() {
                    return Q
                },
                gM: function() {
                    return en
                },
                yB: function() {
                    return er
                },
                N1: function() {
                    return X
                },
                C2: function() {
                    return ee
                },
                sO: function() {
                    return et
                },
                CH: function() {
                    return q
                },
                tj: function() {
                    return V
                },
                hA: function() {
                    return l.hA
                },
                Y7: function() {
                    return l.Y7
                },
                pe: function() {
                    return l.pe
                },
                z4: function() {
                    return l.z4
                },
                Wh: function() {
                    return l.Wh
                },
                Gl: function() {
                    return j
                },
                tL: function() {
                    return M
                },
                oG: function() {
                    return C
                },
                E7: function() {
                    return w
                },
                RM: function() {
                    return d
                },
                RE: function() {
                    return E
                },
                tF: function() {
                    return k
                },
                KQ: function() {
                    return v
                },
                Gv: function() {
                    return O
                },
                Rl: function() {
                    return P
                },
                ej: function() {
                    return S
                },
                JM: function() {
                    return p
                },
                qq: function() {
                    return y
                },
                aC: function() {
                    return N
                },
                cL: function() {
                    return l.cL
                },
                aw: function() {
                    return F
                },
                E2: function() {
                    return B
                },
                o8: function() {
                    return l.o8
                },
                eW: function() {
                    return l.eW
                },
                WZ: function() {
                    return l.WZ
                },
                kP: function() {
                    return l.kP
                },
                xo: function() {
                    return l.xo
                },
                zq: function() {
                    return $
                },
                QS: function() {
                    return K
                },
                aF: function() {
                    return l.aF
                },
                Kr: function() {
                    return U
                },
                B$: function() {
                    return I
                },
                HZ: function() {
                    return A
                },
                Lu: function() {
                    return T
                },
                X: function() {
                    return z
                },
                qH: function() {
                    return L
                },
                Mp: function() {
                    return _
                },
                ge: function() {
                    return b
                },
                r0: function() {
                    return J
                }
            });
            var n = r(6210),
                i = r(27626);
            r(87732);
            var o = r(46214),
                s = r(55185),
                l = r(24494),
                a = r(62350),
                u = new Set,
                c = (e, t, r) => {
                    let n = (0, a.uB)() || (0, a.rx)(),
                        i = r ? ? e;
                    u.has(i) || n || (u.add(i), console.warn(`Clerk - DEPRECATION WARNING: "${e}" is deprecated and will be removed in the next major release.
${t}`))
                },
                d = (0, n.t5)({
                    packageName: "@clerk/clerk-react"
                });

            function p(e) {
                d.setMessages(e).setPackageName(e)
            }
            var [h, f] = (0, l.uH)("AuthContext"), g = l.b5, m = l.rI, v = "You've added multiple <ClerkProvider> components in your React component tree. Wrap your components in a single <ClerkProvider>.", k = e => `You've passed multiple children components to <${e}/>. You can only pass a single child component or text.`, y = "Unsupported usage of isSatellite, domain or proxyUrl. The usage of isSatellite, domain or proxyUrl as function is not supported in non-browser environments.", b = "<UserProfile.Page /> component needs to be a direct child of `<UserProfile />` or `<UserButton />`.", _ = "<UserProfile.Link /> component needs to be a direct child of `<UserProfile />` or `<UserButton />`.", S = "<OrganizationProfile.Page /> component needs to be a direct child of `<OrganizationProfile />` or `<OrganizationSwitcher />`.", P = "<OrganizationProfile.Link /> component needs to be a direct child of `<OrganizationProfile />` or `<OrganizationSwitcher />`.", w = e => `<${e} /> can only accept <${e}.Page /> and <${e}.Link /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.`, C = e => `Missing props. <${e}.Page /> component requires the following props: url, label, labelIcon, alongside with children to be rendered inside the page.`, j = e => `Missing props. <${e}.Link /> component requires the following props: url, label and labelIcon.`, O = e => `The <${e}/> component uses path-based routing by default unless a different routing strategy is provided using the \`routing\` prop. When path-based routing is used, you need to provide the path where the component is mounted on by using the \`path\` prop. Example: <${e} path={'/my-path'} />`, E = e => `The \`path\` prop will only be respected when the Clerk component uses path-based routing. To resolve this error, pass \`routing='path'\` to the <${e}/> component, or drop the \`path\` prop to switch to hash-based routing. For more details please refer to our docs: https://clerk.com/docs`, U = "<UserButton /> can only accept <UserButton.UserProfilePage />, <UserButton.UserProfileLink /> and <UserButton.MenuItems /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.", M = "<UserButton.MenuItems /> component can only accept <UserButton.Action /> and <UserButton.Link /> as its children. Any other provided component will be ignored. Additionally, please ensure that the component is rendered in a client component.", z = "<UserButton.MenuItems /> component needs to be a direct child of `<UserButton />`.", I = "<UserButton.Action /> component needs to be a direct child of `<UserButton.MenuItems />`.", L = "<UserButton.Link /> component needs to be a direct child of `<UserButton.MenuItems />`.", A = "Missing props. <UserButton.Link /> component requires the following props: href, label and labelIcon.", T = "Missing props. <UserButton.Action /> component requires the following props: label.", R = e => {
                (0, l.Rm)(() => {
                    d.throwMissingClerkProviderError({
                        source: e
                    })
                })
            }, W = e => new Promise(t => {
                let r = n => {
                    ["ready", "degraded"].includes(n) && (t(), e.off("status", r))
                };
                e.on("status", r, {
                    notify: !0
                })
            }), x = e => async t => (await W(e), e.session) ? e.session.getToken(t) : null, D = e => async (...t) => (await W(e), e.signOut(...t)), N = (e = {}) => {
                var t, r;
                R("useAuth");
                let {
                    treatPendingAsSignedOut: n,
                    ...i
                } = null != e ? e : {}, l = f();
                void 0 === l.sessionId && void 0 === l.userId && (l = null != i ? i : {});
                let a = m(),
                    u = (0, s.useCallback)(x(a), [a]),
                    c = (0, s.useCallback)(D(a), [a]);
                return null == (t = a.telemetry) || t.record((0, o.J6)("useAuth", {
                    treatPendingAsSignedOut: n
                })), F({ ...l,
                    getToken: u,
                    signOut: c
                }, {
                    treatPendingAsSignedOut: null != n ? n : null == (r = a.__internal_getOption) ? void 0 : r.call(a, "treatPendingAsSignedOut")
                })
            };

            function F(e, {
                treatPendingAsSignedOut: t = !0
            } = {}) {
                let {
                    userId: r,
                    orgId: n,
                    orgRole: o,
                    has: l,
                    signOut: a,
                    getToken: u,
                    orgPermissions: c,
                    factorVerificationAge: p,
                    sessionClaims: h
                } = null != e ? e : {}, f = (0, s.useCallback)(e => l ? l(e) : (0, i.QL)({
                    userId: r,
                    orgId: n,
                    orgRole: o,
                    orgPermissions: c,
                    factorVerificationAge: p,
                    features: (null == h ? void 0 : h.fea) || "",
                    plans: (null == h ? void 0 : h.pla) || ""
                })(e), [l, r, n, o, c, p]);
                return (0, i.qB)({
                    authObject: { ...e,
                        getToken: u,
                        signOut: a,
                        has: f
                    },
                    options: {
                        treatPendingAsSignedOut: t
                    }
                }) || d.throw("Invalid state. Feel free to submit a bug or reach out to support here: https://clerk.com/support")
            }

            function B(e) {
                let {
                    startEmailLinkFlow: t,
                    cancelEmailLinkFlow: r
                } = s.useMemo(() => e.createEmailLinkFlow(), [e]);
                return s.useEffect(() => r, []), {
                    startEmailLinkFlow: t,
                    cancelEmailLinkFlow: r
                }
            }
            var $ = () => {
                    var e;
                    R("useSignIn");
                    let t = m(),
                        r = (0, l.sX)();
                    return (null == (e = t.telemetry) || e.record((0, o.J6)("useSignIn")), r) ? {
                        isLoaded: !0,
                        signIn: r.signIn,
                        setActive: t.setActive
                    } : {
                        isLoaded: !1,
                        signIn: void 0,
                        setActive: void 0
                    }
                },
                K = () => {
                    var e;
                    R("useSignUp");
                    let t = m(),
                        r = (0, l.sX)();
                    return (null == (e = t.telemetry) || e.record((0, o.J6)("useSignUp")), r) ? {
                        isLoaded: !0,
                        signUp: r.signUp,
                        setActive: t.setActive
                    } : {
                        isLoaded: !1,
                        signUp: void 0,
                        setActive: void 0
                    }
                },
                J = (e, t) => {
                    let r = ("string" == typeof t ? t : null == t ? void 0 : t.component) || e.displayName || e.name || "Component";
                    e.displayName = r;
                    let n = "string" == typeof t ? void 0 : t,
                        i = t => {
                            R(r || "withClerk");
                            let i = m();
                            return i.loaded || (null == n ? void 0 : n.renderWhileLoading) ? s.createElement(e, { ...t,
                                component: r,
                                clerk: i
                            }) : null
                        };
                    return i.displayName = `withClerk(${r})`, i
                },
                q = ({
                    children: e,
                    treatPendingAsSignedOut: t
                }) => {
                    R("SignedIn");
                    let {
                        userId: r
                    } = N({
                        treatPendingAsSignedOut: t
                    });
                    return r ? e : null
                },
                V = ({
                    children: e,
                    treatPendingAsSignedOut: t
                }) => {
                    R("SignedOut");
                    let {
                        userId: r
                    } = N({
                        treatPendingAsSignedOut: t
                    });
                    return null === r ? e : null
                },
                G = ({
                    children: e
                }) => (R("ClerkLoaded"), m().loaded) ? e : null,
                Y = ({
                    children: e
                }) => (R("ClerkLoading"), "loading" !== m().status) ? null : e,
                H = ({
                    children: e
                }) => (R("ClerkFailed"), "error" !== m().status) ? null : e,
                Z = ({
                    children: e
                }) => (R("ClerkDegraded"), "degraded" !== m().status) ? null : e,
                Q = ({
                    children: e,
                    fallback: t,
                    treatPendingAsSignedOut: r,
                    ...n
                }) => {
                    R("Protect");
                    let {
                        isLoaded: i,
                        has: o,
                        userId: s
                    } = N({
                        treatPendingAsSignedOut: r
                    });
                    if (!i) return null;
                    let l = null != t ? t : null;
                    return s ? "function" == typeof n.condition ? n.condition(o) ? e : l : n.role || n.permission || n.feature || n.plan ? o(n) ? e : l : e : l
                },
                X = J(({
                    clerk: e,
                    ...t
                }) => {
                    let {
                        client: r,
                        session: n
                    } = e, i = r.signedInSessions ? r.signedInSessions.length > 0 : r.activeSessions && r.activeSessions.length > 0;
                    return s.useEffect(() => {
                        null === n && i ? e.redirectToAfterSignOut() : e.redirectToSignIn(t)
                    }, []), null
                }, "RedirectToSignIn"),
                ee = J(({
                    clerk: e,
                    ...t
                }) => (s.useEffect(() => {
                    e.redirectToSignUp(t)
                }, []), null), "RedirectToSignUp"),
                et = J(({
                    clerk: e
                }) => (s.useEffect(() => {
                    c("RedirectToUserProfile", "Use the `redirectToUserProfile()` method instead."), e.redirectToUserProfile()
                }, []), null), "RedirectToUserProfile"),
                er = J(({
                    clerk: e
                }) => (s.useEffect(() => {
                    c("RedirectToOrganizationProfile", "Use the `redirectToOrganizationProfile()` method instead."), e.redirectToOrganizationProfile()
                }, []), null), "RedirectToOrganizationProfile"),
                en = J(({
                    clerk: e
                }) => (s.useEffect(() => {
                    c("RedirectToCreateOrganization", "Use the `redirectToCreateOrganization()` method instead."), e.redirectToCreateOrganization()
                }, []), null), "RedirectToCreateOrganization"),
                ei = J(({
                    clerk: e,
                    ...t
                }) => (s.useEffect(() => {
                    e.handleRedirectCallback(t)
                }, []), null), "AuthenticateWithRedirectCallback")
        },
        69237: function(e, t, r) {
            "use strict";
            r.d(t, {
                Eg: function() {
                    return eC
                },
                vn: function() {
                    return d.vn
                },
                n9: function() {
                    return d.n9
                },
                KA: function() {
                    return d.KA
                },
                a7: function() {
                    return d.a7
                },
                qI: function() {
                    return d.qI
                },
                El: function() {
                    return eA
                },
                Gp: function() {
                    return ek
                },
                Kb: function() {
                    return eS
                },
                Bg: function() {
                    return e_
                },
                A: function() {
                    return ev
                },
                Li: function() {
                    return eb
                },
                bv: function() {
                    return ew
                },
                Cv: function() {
                    return d.Cv
                },
                gM: function() {
                    return d.gM
                },
                yB: function() {
                    return d.yB
                },
                N1: function() {
                    return d.N1
                },
                C2: function() {
                    return d.C2
                },
                sO: function() {
                    return d.sO
                },
                cL: function() {
                    return eo
                },
                $d: function() {
                    return ej
                },
                qu: function() {
                    return eU
                },
                AM: function() {
                    return eE
                },
                Mo: function() {
                    return es
                },
                gX: function() {
                    return eO
                },
                CH: function() {
                    return d.CH
                },
                tj: function() {
                    return d.tj
                },
                l8: function() {
                    return ef
                },
                Iw: function() {
                    return eu
                },
                yk: function() {
                    return eP
                },
                hA: function() {
                    return d.hA
                },
                Y7: function() {
                    return d.Y7
                },
                pe: function() {
                    return d.pe
                },
                z4: function() {
                    return d.z4
                },
                Wh: function() {
                    return d.Wh
                },
                aC: function() {
                    return d.aC
                },
                ll: function() {
                    return d.cL
                },
                E2: function() {
                    return d.E2
                },
                o8: function() {
                    return d.o8
                },
                eW: function() {
                    return d.eW
                },
                WZ: function() {
                    return d.WZ
                },
                kP: function() {
                    return d.kP
                },
                xo: function() {
                    return d.xo
                },
                zq: function() {
                    return d.zq
                },
                QS: function() {
                    return d.QS
                },
                aF: function() {
                    return d.aF
                }
            });
            var n, i, o, s, l, a, u, c, d = r(66517),
                p = e => {
                    throw TypeError(e)
                },
                h = (e, t, r) => t.has(e) || p("Cannot " + r),
                f = (e, t, r) => (h(e, t, "read from private field"), r ? r.call(e) : t.get(e)),
                g = (e, t, r) => t.has(e) ? p("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, r),
                m = (e, t, r, n) => (h(e, t, "write to private field"), n ? n.call(e, r) : t.set(e, r), r),
                v = (e, t, r) => (h(e, t, "access private method"), r),
                k = r(82467),
                y = r(48203),
                b = r(55185),
                _ = r(19892),
                S = (e, ...t) => {
                    let r = { ...e
                    };
                    for (let e of t) delete r[e];
                    return r
                };
            r(87732);
            var P = r(24494),
                w = r(9152),
                C = (e, t, r) => !e && r ? j(r) : O(t),
                j = e => {
                    let t = e.userId,
                        r = e.user,
                        n = e.sessionId,
                        i = e.sessionStatus,
                        o = e.sessionClaims,
                        s = e.session,
                        l = e.organization,
                        a = e.orgId,
                        u = e.orgRole,
                        c = e.orgPermissions;
                    return {
                        userId: t,
                        user: r,
                        sessionId: n,
                        session: s,
                        sessionStatus: i,
                        sessionClaims: o,
                        organization: l,
                        orgId: a,
                        orgRole: u,
                        orgPermissions: c,
                        orgSlug: e.orgSlug,
                        actor: e.actor,
                        factorVerificationAge: e.factorVerificationAge
                    }
                },
                O = e => {
                    let t = e.user ? e.user.id : e.user,
                        r = e.user,
                        n = e.session ? e.session.id : e.session,
                        i = e.session,
                        o = e.session ? .status,
                        s = e.session ? e.session.lastActiveToken ? .jwt ? .claims : null,
                        l = e.session ? e.session.factorVerificationAge : null,
                        a = i ? .actor,
                        u = e.organization,
                        c = e.organization ? e.organization.id : e.organization,
                        d = u ? .slug,
                        p = u ? r ? .organizationMemberships ? .find(e => e.organization.id === c) : u,
                        h = p ? p.permissions : p;
                    return {
                        userId: t,
                        user: r,
                        sessionId: n,
                        session: i,
                        sessionStatus: o,
                        sessionClaims: s,
                        organization: u,
                        orgId: c,
                        orgRole: p ? p.role : p,
                        orgSlug: d,
                        orgPermissions: h,
                        actor: a,
                        factorVerificationAge: l
                    }
                },
                E = r(86085),
                U = (e, t, r, n, i) => {
                    let {
                        notify: o
                    } = i || {}, s = e.get(r);
                    s || (s = [], e.set(r, s)), s.push(n), o && t.has(r) && n(t.get(r))
                },
                M = (e, t, r) => (e.get(t) || []).map(e => e(r)),
                z = (e, t, r) => {
                    let n = e.get(t);
                    n && (r ? n.splice(n.indexOf(r) >>> 0, 1) : e.set(t, []))
                },
                I = () => {
                    let e = new Map,
                        t = new Map,
                        r = new Map;
                    return {
                        on: (...r) => U(e, t, ...r),
                        prioritizedOn: (...e) => U(r, t, ...e),
                        emit: (n, i) => {
                            t.set(n, i), M(r, n, i), M(e, n, i)
                        },
                        off: (...t) => z(e, ...t),
                        prioritizedOff: (...e) => z(r, ...e),
                        internal: {
                            retrieveListeners: t => e.get(t) || []
                        }
                    }
                },
                L = {
                    Status: "status"
                },
                A = () => I();
            "undefined" == typeof window || window.global || (window.global = "undefined" == typeof global ? window : global);
            var T = e => t => {
                    try {
                        return b.Children.only(e)
                    } catch {
                        return d.RM.throw((0, d.tF)(t))
                    }
                },
                R = (e, t) => (e || (e = t), "string" == typeof e && (e = b.createElement("button", null, e)), e),
                W = e => (...t) => {
                    if (e && "function" == typeof e) return e(...t)
                },
                x = new Map,
                D = e => {
                    let t = Array(e.length).fill(null),
                        [r, n] = (0, b.useState)(t);
                    return e.map((e, t) => ({
                        id: e.id,
                        mount: e => n(r => r.map((r, n) => n === t ? e : r)),
                        unmount: () => n(e => e.map((e, r) => r === t ? null : e)),
                        portal: () => b.createElement(b.Fragment, null, r[t] ? (0, _.createPortal)(e.component, r[t]) : null)
                    }))
                },
                N = (e, t) => !!e && b.isValidElement(e) && (null == e ? void 0 : e.type) === t,
                F = (e, t) => K({
                    children: e,
                    reorderItemsLabels: ["account", "security"],
                    LinkComponent: ea,
                    PageComponent: el,
                    MenuItemsComponent: ed,
                    componentName: "UserProfile"
                }, t),
                B = (e, t) => K({
                    children: e,
                    reorderItemsLabels: ["general", "members"],
                    LinkComponent: em,
                    PageComponent: eg,
                    componentName: "OrganizationProfile"
                }, t),
                $ = e => {
                    let t = [],
                        r = [em, eg, ed, el, ea];
                    return b.Children.forEach(e, e => {
                        r.some(t => N(e, t)) || t.push(e)
                    }), t
                },
                K = (e, t) => {
                    let {
                        children: r,
                        LinkComponent: n,
                        PageComponent: i,
                        MenuItemsComponent: o,
                        reorderItemsLabels: s,
                        componentName: l
                    } = e, {
                        allowForAnyChildren: a = !1
                    } = t || {}, u = [];
                    b.Children.forEach(r, e => {
                        if (!N(e, i) && !N(e, n) && !N(e, o)) {
                            e && !a && (0, y.yJ)((0, d.E7)(l));
                            return
                        }
                        let {
                            props: t
                        } = e, {
                            children: r,
                            label: c,
                            url: p,
                            labelIcon: h
                        } = t;
                        if (N(e, i)) {
                            if (J(t, s)) u.push({
                                label: c
                            });
                            else if (q(t)) u.push({
                                label: c,
                                labelIcon: h,
                                children: r,
                                url: p
                            });
                            else {
                                (0, y.yJ)((0, d.oG)(l));
                                return
                            }
                        }
                        if (N(e, n)) {
                            if (V(t)) u.push({
                                label: c,
                                labelIcon: h,
                                url: p
                            });
                            else {
                                (0, y.yJ)((0, d.Gl)(l));
                                return
                            }
                        }
                    });
                    let c = [],
                        p = [],
                        h = [];
                    u.forEach((e, t) => {
                        if (q(e)) {
                            c.push({
                                component: e.children,
                                id: t
                            }), p.push({
                                component: e.labelIcon,
                                id: t
                            });
                            return
                        }
                        V(e) && h.push({
                            component: e.labelIcon,
                            id: t
                        })
                    });
                    let f = D(c),
                        g = D(p),
                        m = D(h),
                        v = [],
                        k = [];
                    return u.forEach((e, t) => {
                        if (J(e, s)) {
                            v.push({
                                label: e.label
                            });
                            return
                        }
                        if (q(e)) {
                            let {
                                portal: r,
                                mount: n,
                                unmount: i
                            } = f.find(e => e.id === t), {
                                portal: o,
                                mount: s,
                                unmount: l
                            } = g.find(e => e.id === t);
                            v.push({
                                label: e.label,
                                url: e.url,
                                mount: n,
                                unmount: i,
                                mountIcon: s,
                                unmountIcon: l
                            }), k.push(r), k.push(o);
                            return
                        }
                        if (V(e)) {
                            let {
                                portal: r,
                                mount: n,
                                unmount: i
                            } = m.find(e => e.id === t);
                            v.push({
                                label: e.label,
                                url: e.url,
                                mountIcon: n,
                                unmountIcon: i
                            }), k.push(r);
                            return
                        }
                    }), {
                        customPages: v,
                        customPagesPortals: k
                    }
                },
                J = (e, t) => {
                    let {
                        children: r,
                        label: n,
                        url: i,
                        labelIcon: o
                    } = e;
                    return !r && !i && !o && t.some(e => e === n)
                },
                q = e => {
                    let {
                        children: t,
                        label: r,
                        url: n,
                        labelIcon: i
                    } = e;
                    return !!t && !!n && !!i && !!r
                },
                V = e => {
                    let {
                        children: t,
                        label: r,
                        url: n,
                        labelIcon: i
                    } = e;
                    return !t && !!n && !!i && !!r
                },
                G = e => Y({
                    children: e,
                    reorderItemsLabels: ["manageAccount", "signOut"],
                    MenuItemsComponent: ed,
                    MenuActionComponent: ep,
                    MenuLinkComponent: eh,
                    UserProfileLinkComponent: ea,
                    UserProfilePageComponent: el
                }),
                Y = ({
                    children: e,
                    MenuItemsComponent: t,
                    MenuActionComponent: r,
                    MenuLinkComponent: n,
                    UserProfileLinkComponent: i,
                    UserProfilePageComponent: o,
                    reorderItemsLabels: s
                }) => {
                    let l = [],
                        a = [],
                        u = [];
                    b.Children.forEach(e, e => {
                        if (!N(e, t) && !N(e, i) && !N(e, o)) {
                            e && (0, y.yJ)(d.Kr);
                            return
                        }
                        if (N(e, i) || N(e, o)) return;
                        let {
                            props: a
                        } = e;
                        b.Children.forEach(a.children, e => {
                            if (!N(e, r) && !N(e, n)) {
                                e && (0, y.yJ)(d.tL);
                                return
                            }
                            let {
                                props: t
                            } = e, {
                                label: i,
                                labelIcon: o,
                                href: a,
                                onClick: u,
                                open: c
                            } = t;
                            if (N(e, r)) {
                                if (H(t, s)) l.push({
                                    label: i
                                });
                                else if (Z(t)) {
                                    let e = {
                                        label: i,
                                        labelIcon: o
                                    };
                                    if (void 0 !== u) l.push({ ...e,
                                        onClick: u
                                    });
                                    else if (void 0 !== c) l.push({ ...e,
                                        open: c.startsWith("/") ? c : `/${c}`
                                    });
                                    else {
                                        (0, y.yJ)("Custom menu item must have either onClick or open property");
                                        return
                                    }
                                } else {
                                    (0, y.yJ)(d.Lu);
                                    return
                                }
                            }
                            if (N(e, n)) {
                                if (Q(t)) l.push({
                                    label: i,
                                    labelIcon: o,
                                    href: a
                                });
                                else {
                                    (0, y.yJ)(d.HZ);
                                    return
                                }
                            }
                        })
                    });
                    let c = [],
                        p = [];
                    l.forEach((e, t) => {
                        Z(e) && c.push({
                            component: e.labelIcon,
                            id: t
                        }), Q(e) && p.push({
                            component: e.labelIcon,
                            id: t
                        })
                    });
                    let h = D(c),
                        f = D(p);
                    return l.forEach((e, t) => {
                        if (H(e, s) && a.push({
                                label: e.label
                            }), Z(e)) {
                            let {
                                portal: r,
                                mount: n,
                                unmount: i
                            } = h.find(e => e.id === t), o = {
                                label: e.label,
                                mountIcon: n,
                                unmountIcon: i
                            };
                            "onClick" in e ? o.onClick = e.onClick : "open" in e && (o.open = e.open), a.push(o), u.push(r)
                        }
                        if (Q(e)) {
                            let {
                                portal: r,
                                mount: n,
                                unmount: i
                            } = f.find(e => e.id === t);
                            a.push({
                                label: e.label,
                                href: e.href,
                                mountIcon: n,
                                unmountIcon: i
                            }), u.push(r)
                        }
                    }), {
                        customMenuItems: a,
                        customMenuItemsPortals: u
                    }
                },
                H = (e, t) => {
                    let {
                        children: r,
                        label: n,
                        onClick: i,
                        labelIcon: o
                    } = e;
                    return !r && !i && !o && t.some(e => e === n)
                },
                Z = e => {
                    let {
                        label: t,
                        labelIcon: r,
                        onClick: n,
                        open: i
                    } = e;
                    return !!r && !!t && ("function" == typeof n || "string" == typeof i)
                },
                Q = e => {
                    let {
                        label: t,
                        href: r,
                        labelIcon: n
                    } = e;
                    return !!r && !!n && !!t
                };

            function X(e) {
                let t = (0, b.useRef)(),
                    [r, n] = (0, b.useState)("rendering");
                return (0, b.useEffect)(() => {
                    if (!e) throw Error("Clerk: no component name provided, unable to detect mount.");
                    "undefined" == typeof window || t.current || (t.current = (function(e) {
                        let {
                            root: t = null == document ? void 0 : document.body,
                            selector: r,
                            timeout: n = 0
                        } = e;
                        return new Promise((e, i) => {
                            if (!t) {
                                i(Error("No root element provided"));
                                return
                            }
                            let o = t;
                            if (r && (o = null == t ? void 0 : t.querySelector(r)), (null == o ? void 0 : o.childElementCount) && o.childElementCount > 0) {
                                e();
                                return
                            }
                            let s = new MutationObserver(n => {
                                for (let i of n)
                                    if ("childList" === i.type && (!o && r && (o = null == t ? void 0 : t.querySelector(r)), (null == o ? void 0 : o.childElementCount) && o.childElementCount > 0)) {
                                        s.disconnect(), e();
                                        return
                                    }
                            });
                            s.observe(t, {
                                childList: !0,
                                subtree: !0
                            }), n > 0 && setTimeout(() => {
                                s.disconnect(), i(Error("Timeout waiting for element children"))
                            }, n)
                        })
                    })({
                        selector: `[data-clerk-component="${e}"]`
                    }).then(() => {
                        n("rendered")
                    }).catch(() => {
                        n("error")
                    }))
                }, [e]), r
            }
            var ee = e => "mount" in e,
                et = e => "open" in e,
                er = e => null == e ? void 0 : e.map(({
                    mountIcon: e,
                    unmountIcon: t,
                    ...r
                }) => r),
                en = class extends b.PureComponent {
                    constructor() {
                        super(...arguments), this.rootRef = b.createRef()
                    }
                    componentDidUpdate(e) {
                        var t, r, n, i;
                        if (!ee(e) || !ee(this.props)) return;
                        let o = S(e.props, "customPages", "customMenuItems", "children"),
                            s = S(this.props.props, "customPages", "customMenuItems", "children"),
                            l = (null == (t = o.customPages) ? void 0 : t.length) !== (null == (r = s.customPages) ? void 0 : r.length),
                            a = (null == (n = o.customMenuItems) ? void 0 : n.length) !== (null == (i = s.customMenuItems) ? void 0 : i.length),
                            u = er(e.props.customMenuItems),
                            c = er(this.props.props.customMenuItems);
                        (!(0, P.c1)(o, s) || !(0, P.c1)(u, c) || l || a) && this.rootRef.current && this.props.updateProps({
                            node: this.rootRef.current,
                            props: this.props.props
                        })
                    }
                    componentDidMount() {
                        this.rootRef.current && (ee(this.props) && this.props.mount(this.rootRef.current, this.props.props), et(this.props) && this.props.open(this.props.props))
                    }
                    componentWillUnmount() {
                        this.rootRef.current && (ee(this.props) && this.props.unmount(this.rootRef.current), et(this.props) && this.props.close())
                    }
                    render() {
                        let {
                            hideRootHtmlElement: e = !1
                        } = this.props, t = {
                            ref: this.rootRef,
                            ...this.props.rootProps,
                            ...this.props.component && {
                                "data-clerk-component": this.props.component
                            }
                        };
                        return b.createElement(b.Fragment, null, !e && b.createElement("div", { ...t
                        }), this.props.children)
                    }
                },
                ei = e => {
                    var t, r;
                    return b.createElement(b.Fragment, null, null == (t = null == e ? void 0 : e.customPagesPortals) ? void 0 : t.map((e, t) => (0, b.createElement)(e, {
                        key: t
                    })), null == (r = null == e ? void 0 : e.customMenuItemsPortals) ? void 0 : r.map((e, t) => (0, b.createElement)(e, {
                        key: t
                    })))
                },
                eo = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountSignIn,
                        unmount: e.unmountSignIn,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "SignIn",
                    renderWhileLoading: !0
                }),
                es = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountSignUp,
                        unmount: e.unmountSignUp,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "SignUp",
                    renderWhileLoading: !0
                });

            function el({
                children: e
            }) {
                return (0, y.yJ)(d.ge), b.createElement(b.Fragment, null, e)
            }

            function ea({
                children: e
            }) {
                return (0, y.yJ)(d.Mp), b.createElement(b.Fragment, null, e)
            }
            var eu = Object.assign((0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        },
                        {
                            customPages: s,
                            customPagesPortals: l
                        } = F(n.children);
                    return b.createElement(b.Fragment, null, i && r, b.createElement(en, {
                        component: t,
                        mount: e.mountUserProfile,
                        unmount: e.unmountUserProfile,
                        updateProps: e.__unstable__updateProps,
                        props: { ...n,
                            customPages: s
                        },
                        rootProps: o
                    }, b.createElement(ei, {
                        customPagesPortals: l
                    })))
                }, {
                    component: "UserProfile",
                    renderWhileLoading: !0
                }), {
                    Page: el,
                    Link: ea
                }),
                ec = (0, b.createContext)({
                    mount: () => {},
                    unmount: () => {},
                    updateProps: () => {}
                });

            function ed({
                children: e
            }) {
                return (0, y.yJ)(d.X), b.createElement(b.Fragment, null, e)
            }

            function ep({
                children: e
            }) {
                return (0, y.yJ)(d.B$), b.createElement(b.Fragment, null, e)
            }

            function eh({
                children: e
            }) {
                return (0, y.yJ)(d.qH), b.createElement(b.Fragment, null, e)
            }
            var ef = Object.assign((0, d.r0)(({
                clerk: e,
                component: t,
                fallback: r,
                ...n
            }) => {
                let i = "rendering" === X(t) || !e.loaded,
                    o = { ...i && r && {
                            style: {
                                display: "none"
                            }
                        }
                    },
                    {
                        customPages: s,
                        customPagesPortals: l
                    } = F(n.children, {
                        allowForAnyChildren: !!n.__experimental_asProvider
                    }),
                    a = Object.assign(n.userProfileProps || {}, {
                        customPages: s
                    }),
                    {
                        customMenuItems: u,
                        customMenuItemsPortals: c
                    } = G(n.children),
                    d = $(n.children),
                    p = {
                        mount: e.mountUserButton,
                        unmount: e.unmountUserButton,
                        updateProps: e.__unstable__updateProps,
                        props: { ...n,
                            userProfileProps: a,
                            customMenuItems: u
                        }
                    };
                return b.createElement(ec.Provider, {
                    value: p
                }, i && r, e.loaded && b.createElement(en, {
                    component: t,
                    ...p,
                    hideRootHtmlElement: !!n.__experimental_asProvider,
                    rootProps: o
                }, n.__experimental_asProvider ? d : null, b.createElement(ei, {
                    customPagesPortals: l,
                    customMenuItemsPortals: c
                })))
            }, {
                component: "UserButton",
                renderWhileLoading: !0
            }), {
                UserProfilePage: el,
                UserProfileLink: ea,
                MenuItems: ed,
                Action: ep,
                Link: eh,
                __experimental_Outlet: function(e) {
                    let t = (0, b.useContext)(ec),
                        r = { ...t,
                            props: { ...t.props,
                                ...e
                            }
                        };
                    return b.createElement(en, { ...r
                    })
                }
            });

            function eg({
                children: e
            }) {
                return (0, y.yJ)(d.ej), b.createElement(b.Fragment, null, e)
            }

            function em({
                children: e
            }) {
                return (0, y.yJ)(d.Rl), b.createElement(b.Fragment, null, e)
            }
            var ev = Object.assign((0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        },
                        {
                            customPages: s,
                            customPagesPortals: l
                        } = B(n.children);
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountOrganizationProfile,
                        unmount: e.unmountOrganizationProfile,
                        updateProps: e.__unstable__updateProps,
                        props: { ...n,
                            customPages: s
                        },
                        rootProps: o
                    }, b.createElement(ei, {
                        customPagesPortals: l
                    })))
                }, {
                    component: "OrganizationProfile",
                    renderWhileLoading: !0
                }), {
                    Page: eg,
                    Link: em
                }),
                ek = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountCreateOrganization,
                        unmount: e.unmountCreateOrganization,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "CreateOrganization",
                    renderWhileLoading: !0
                }),
                ey = (0, b.createContext)({
                    mount: () => {},
                    unmount: () => {},
                    updateProps: () => {}
                }),
                eb = Object.assign((0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        },
                        {
                            customPages: s,
                            customPagesPortals: l
                        } = B(n.children, {
                            allowForAnyChildren: !!n.__experimental_asProvider
                        }),
                        a = Object.assign(n.organizationProfileProps || {}, {
                            customPages: s
                        }),
                        u = $(n.children),
                        c = {
                            mount: e.mountOrganizationSwitcher,
                            unmount: e.unmountOrganizationSwitcher,
                            updateProps: e.__unstable__updateProps,
                            props: { ...n,
                                organizationProfileProps: a
                            },
                            rootProps: o,
                            component: t
                        };
                    return e.__experimental_prefetchOrganizationSwitcher(), b.createElement(ey.Provider, {
                        value: c
                    }, b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, { ...c,
                        hideRootHtmlElement: !!n.__experimental_asProvider
                    }, n.__experimental_asProvider ? u : null, b.createElement(ei, {
                        customPagesPortals: l
                    }))))
                }, {
                    component: "OrganizationSwitcher",
                    renderWhileLoading: !0
                }), {
                    OrganizationProfilePage: eg,
                    OrganizationProfileLink: em,
                    __experimental_Outlet: function(e) {
                        let t = (0, b.useContext)(ey),
                            r = { ...t,
                                props: { ...t.props,
                                    ...e
                                }
                            };
                        return b.createElement(en, { ...r
                        })
                    }
                }),
                e_ = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountOrganizationList,
                        unmount: e.unmountOrganizationList,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "OrganizationList",
                    renderWhileLoading: !0
                }),
                eS = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        open: e.openGoogleOneTap,
                        close: e.closeGoogleOneTap,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "GoogleOneTap",
                    renderWhileLoading: !0
                }),
                eP = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountWaitlist,
                        unmount: e.unmountWaitlist,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "Waitlist",
                    renderWhileLoading: !0
                }),
                ew = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountPricingTable,
                        unmount: e.unmountPricingTable,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "PricingTable",
                    renderWhileLoading: !0
                }),
                eC = (0, d.r0)(({
                    clerk: e,
                    component: t,
                    fallback: r,
                    ...n
                }) => {
                    let i = "rendering" === X(t) || !e.loaded,
                        o = { ...i && r && {
                                style: {
                                    display: "none"
                                }
                            }
                        };
                    return b.createElement(b.Fragment, null, i && r, e.loaded && b.createElement(en, {
                        component: t,
                        mount: e.mountApiKeys,
                        unmount: e.unmountApiKeys,
                        updateProps: e.__unstable__updateProps,
                        props: n,
                        rootProps: o
                    }))
                }, {
                    component: "ApiKeys",
                    renderWhileLoading: !0
                }),
                ej = (0, d.r0)(({
                    clerk: e,
                    children: t,
                    ...r
                }) => {
                    let {
                        signUpFallbackRedirectUrl: n,
                        forceRedirectUrl: i,
                        fallbackRedirectUrl: o,
                        signUpForceRedirectUrl: s,
                        mode: l,
                        initialValues: a,
                        withSignUp: u,
                        oauthFlow: c,
                        ...d
                    } = r, p = T(t = R(t, "Sign in"))("SignInButton"), h = () => {
                        let t = {
                            forceRedirectUrl: i,
                            fallbackRedirectUrl: o,
                            signUpFallbackRedirectUrl: n,
                            signUpForceRedirectUrl: s,
                            initialValues: a,
                            withSignUp: u,
                            oauthFlow: c
                        };
                        return "modal" === l ? e.openSignIn({ ...t,
                            appearance: r.appearance
                        }) : e.redirectToSignIn({ ...t,
                            signInFallbackRedirectUrl: o,
                            signInForceRedirectUrl: i
                        })
                    }, f = async e => (p && "object" == typeof p && "props" in p && await W(p.props.onClick)(e), h()), g = { ...d,
                        onClick: f
                    };
                    return b.cloneElement(p, g)
                }, {
                    component: "SignInButton",
                    renderWhileLoading: !0
                }),
                eO = (0, d.r0)(({
                    clerk: e,
                    children: t,
                    ...r
                }) => {
                    let {
                        fallbackRedirectUrl: n,
                        forceRedirectUrl: i,
                        signInFallbackRedirectUrl: o,
                        signInForceRedirectUrl: s,
                        mode: l,
                        initialValues: a,
                        oauthFlow: u,
                        ...c
                    } = r, d = T(t = R(t, "Sign up"))("SignUpButton"), p = () => {
                        let t = {
                            fallbackRedirectUrl: n,
                            forceRedirectUrl: i,
                            signInFallbackRedirectUrl: o,
                            signInForceRedirectUrl: s,
                            initialValues: a,
                            oauthFlow: u
                        };
                        return "modal" === l ? e.openSignUp({ ...t,
                            appearance: r.appearance,
                            unsafeMetadata: r.unsafeMetadata
                        }) : e.redirectToSignUp({ ...t,
                            signUpFallbackRedirectUrl: n,
                            signUpForceRedirectUrl: i
                        })
                    }, h = async e => (d && "object" == typeof d && "props" in d && await W(d.props.onClick)(e), p()), f = { ...c,
                        onClick: h
                    };
                    return b.cloneElement(d, f)
                }, {
                    component: "SignUpButton",
                    renderWhileLoading: !0
                }),
                eE = (0, d.r0)(({
                    clerk: e,
                    children: t,
                    ...r
                }) => {
                    let {
                        redirectUrl: n = "/",
                        signOutOptions: i,
                        ...o
                    } = r, s = T(t = R(t, "Sign out"))("SignOutButton"), l = () => e.signOut({
                        redirectUrl: n,
                        ...i
                    }), a = async e => (await W(s.props.onClick)(e), l()), u = { ...o,
                        onClick: a
                    };
                    return b.cloneElement(s, u)
                }, {
                    component: "SignOutButton",
                    renderWhileLoading: !0
                }),
                eU = (0, d.r0)(({
                    clerk: e,
                    children: t,
                    ...r
                }) => {
                    let {
                        redirectUrl: n,
                        ...i
                    } = r, o = T(t = R(t, "Sign in with Metamask"))("SignInWithMetamaskButton"), s = async () => {
                        !async function() {
                            await e.authenticateWithMetamask({
                                redirectUrl: n || void 0
                            })
                        }()
                    }, l = async e => (await W(o.props.onClick)(e), s()), a = { ...i,
                        onClick: l
                    };
                    return b.cloneElement(o, a)
                }, {
                    component: "SignInWithMetamask",
                    renderWhileLoading: !0
                });
            void 0 === globalThis.__BUILD_DISABLE_RHC__ && (globalThis.__BUILD_DISABLE_RHC__ = !1);
            var eM = {
                    name: "@clerk/clerk-react",
                    version: "5.35.4",
                    environment: "production"
                },
                ez = class e {
                    constructor(e) {
                        g(this, u), this.clerkjs = null, this.preopenOneTap = null, this.preopenUserVerification = null, this.preopenSignIn = null, this.preopenCheckout = null, this.preopenPlanDetails = null, this.preopenSubscriptionDetails = null, this.preopenSignUp = null, this.preopenUserProfile = null, this.preopenOrganizationProfile = null, this.preopenCreateOrganization = null, this.preOpenWaitlist = null, this.premountSignInNodes = new Map, this.premountSignUpNodes = new Map, this.premountUserProfileNodes = new Map, this.premountUserButtonNodes = new Map, this.premountOrganizationProfileNodes = new Map, this.premountCreateOrganizationNodes = new Map, this.premountOrganizationSwitcherNodes = new Map, this.premountOrganizationListNodes = new Map, this.premountMethodCalls = new Map, this.premountWaitlistNodes = new Map, this.premountPricingTableNodes = new Map, this.premountApiKeysNodes = new Map, this.premountOAuthConsentNodes = new Map, this.premountAddListenerCalls = new Map, this.loadedListeners = [], g(this, n, "loading"), g(this, i), g(this, o), g(this, s), g(this, l, A()), this.buildSignInUrl = e => {
                            let t = () => {
                                var t;
                                return (null == (t = this.clerkjs) ? void 0 : t.buildSignInUrl(e)) || ""
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("buildSignInUrl", t)
                        }, this.buildSignUpUrl = e => {
                            let t = () => {
                                var t;
                                return (null == (t = this.clerkjs) ? void 0 : t.buildSignUpUrl(e)) || ""
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("buildSignUpUrl", t)
                        }, this.buildAfterSignInUrl = (...e) => {
                            let t = () => {
                                var t;
                                return (null == (t = this.clerkjs) ? void 0 : t.buildAfterSignInUrl(...e)) || ""
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("buildAfterSignInUrl", t)
                        }, this.buildAfterSignUpUrl = (...e) => {
                            let t = () => {
                                var t;
                                return (null == (t = this.clerkjs) ? void 0 : t.buildAfterSignUpUrl(...e)) || ""
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("buildAfterSignUpUrl", t)
                        }, this.buildAfterSignOutUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildAfterSignOutUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildAfterSignOutUrl", e)
                        }, this.buildNewSubscriptionRedirectUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildNewSubscriptionRedirectUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildNewSubscriptionRedirectUrl", e)
                        }, this.buildAfterMultiSessionSingleSignOutUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildAfterMultiSessionSingleSignOutUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildAfterMultiSessionSingleSignOutUrl", e)
                        }, this.buildUserProfileUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildUserProfileUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildUserProfileUrl", e)
                        }, this.buildCreateOrganizationUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildCreateOrganizationUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildCreateOrganizationUrl", e)
                        }, this.buildOrganizationProfileUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildOrganizationProfileUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildOrganizationProfileUrl", e)
                        }, this.buildWaitlistUrl = () => {
                            let e = () => {
                                var e;
                                return (null == (e = this.clerkjs) ? void 0 : e.buildWaitlistUrl()) || ""
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("buildWaitlistUrl", e)
                        }, this.buildUrlWithAuth = e => {
                            let t = () => {
                                var t;
                                return (null == (t = this.clerkjs) ? void 0 : t.buildUrlWithAuth(e)) || ""
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("buildUrlWithAuth", t)
                        }, this.handleUnauthenticated = async () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.handleUnauthenticated()
                            };
                            this.clerkjs && this.loaded ? e() : this.premountMethodCalls.set("handleUnauthenticated", e)
                        }, this.on = (...e) => {
                            var t;
                            if (null == (t = this.clerkjs) ? void 0 : t.on) return this.clerkjs.on(...e);
                            f(this, l).on(...e)
                        }, this.off = (...e) => {
                            var t;
                            if (null == (t = this.clerkjs) ? void 0 : t.off) return this.clerkjs.off(...e);
                            f(this, l).off(...e)
                        }, this.addOnLoaded = e => {
                            this.loadedListeners.push(e), this.loaded && this.emitLoaded()
                        }, this.emitLoaded = () => {
                            this.loadedListeners.forEach(e => e()), this.loadedListeners = []
                        }, this.beforeLoad = e => {
                            if (!e) throw Error("Failed to hydrate latest Clerk JS")
                        }, this.hydrateClerkJS = e => {
                            var t;
                            if (!e) throw Error("Failed to hydrate latest Clerk JS");
                            return this.clerkjs = e, this.premountMethodCalls.forEach(e => e()), this.premountAddListenerCalls.forEach((t, r) => {
                                t.nativeUnsubscribe = e.addListener(r)
                            }), null == (t = f(this, l).internal.retrieveListeners("status")) || t.forEach(e => {
                                this.on("status", e, {
                                    notify: !0
                                })
                            }), null !== this.preopenSignIn && e.openSignIn(this.preopenSignIn), null !== this.preopenCheckout && e.__internal_openCheckout(this.preopenCheckout), null !== this.preopenPlanDetails && e.__internal_openPlanDetails(this.preopenPlanDetails), null !== this.preopenSubscriptionDetails && e.__internal_openSubscriptionDetails(this.preopenSubscriptionDetails), null !== this.preopenSignUp && e.openSignUp(this.preopenSignUp), null !== this.preopenUserProfile && e.openUserProfile(this.preopenUserProfile), null !== this.preopenUserVerification && e.__internal_openReverification(this.preopenUserVerification), null !== this.preopenOneTap && e.openGoogleOneTap(this.preopenOneTap), null !== this.preopenOrganizationProfile && e.openOrganizationProfile(this.preopenOrganizationProfile), null !== this.preopenCreateOrganization && e.openCreateOrganization(this.preopenCreateOrganization), null !== this.preOpenWaitlist && e.openWaitlist(this.preOpenWaitlist), this.premountSignInNodes.forEach((t, r) => {
                                e.mountSignIn(r, t)
                            }), this.premountSignUpNodes.forEach((t, r) => {
                                e.mountSignUp(r, t)
                            }), this.premountUserProfileNodes.forEach((t, r) => {
                                e.mountUserProfile(r, t)
                            }), this.premountUserButtonNodes.forEach((t, r) => {
                                e.mountUserButton(r, t)
                            }), this.premountOrganizationListNodes.forEach((t, r) => {
                                e.mountOrganizationList(r, t)
                            }), this.premountWaitlistNodes.forEach((t, r) => {
                                e.mountWaitlist(r, t)
                            }), this.premountPricingTableNodes.forEach((t, r) => {
                                e.mountPricingTable(r, t)
                            }), this.premountApiKeysNodes.forEach((t, r) => {
                                e.mountApiKeys(r, t)
                            }), this.premountOAuthConsentNodes.forEach((t, r) => {
                                e.__internal_mountOAuthConsent(r, t)
                            }), void 0 === this.clerkjs.status && f(this, l).emit(L.Status, "ready"), this.emitLoaded(), this.clerkjs
                        }, this.__experimental_checkout = (...e) => {
                            var t;
                            return null == (t = this.clerkjs) ? void 0 : t.__experimental_checkout(...e)
                        }, this.__unstable__updateProps = async e => {
                            let t = await v(this, u, c).call(this);
                            if (t && "__unstable__updateProps" in t) return t.__unstable__updateProps(e)
                        }, this.__internal_navigateToTaskIfAvailable = async e => this.clerkjs ? this.clerkjs.__internal_navigateToTaskIfAvailable(e) : Promise.reject(), this.setActive = e => this.clerkjs ? this.clerkjs.setActive(e) : Promise.reject(), this.openSignIn = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openSignIn(e) : this.preopenSignIn = e
                        }, this.closeSignIn = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeSignIn() : this.preopenSignIn = null
                        }, this.__internal_openCheckout = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_openCheckout(e) : this.preopenCheckout = e
                        }, this.__internal_closeCheckout = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_closeCheckout() : this.preopenCheckout = null
                        }, this.__internal_openPlanDetails = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_openPlanDetails(e) : this.preopenPlanDetails = e
                        }, this.__internal_closePlanDetails = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_closePlanDetails() : this.preopenPlanDetails = null
                        }, this.__internal_openSubscriptionDetails = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_openSubscriptionDetails(e) : this.preopenSubscriptionDetails = null != e ? e : null
                        }, this.__internal_closeSubscriptionDetails = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_closeSubscriptionDetails() : this.preopenSubscriptionDetails = null
                        }, this.__internal_openReverification = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_openReverification(e) : this.preopenUserVerification = e
                        }, this.__internal_closeReverification = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_closeReverification() : this.preopenUserVerification = null
                        }, this.openGoogleOneTap = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openGoogleOneTap(e) : this.preopenOneTap = e
                        }, this.closeGoogleOneTap = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeGoogleOneTap() : this.preopenOneTap = null
                        }, this.openUserProfile = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openUserProfile(e) : this.preopenUserProfile = e
                        }, this.closeUserProfile = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeUserProfile() : this.preopenUserProfile = null
                        }, this.openOrganizationProfile = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openOrganizationProfile(e) : this.preopenOrganizationProfile = e
                        }, this.closeOrganizationProfile = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeOrganizationProfile() : this.preopenOrganizationProfile = null
                        }, this.openCreateOrganization = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openCreateOrganization(e) : this.preopenCreateOrganization = e
                        }, this.closeCreateOrganization = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeCreateOrganization() : this.preopenCreateOrganization = null
                        }, this.openWaitlist = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openWaitlist(e) : this.preOpenWaitlist = e
                        }, this.closeWaitlist = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeWaitlist() : this.preOpenWaitlist = null
                        }, this.openSignUp = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.openSignUp(e) : this.preopenSignUp = e
                        }, this.closeSignUp = () => {
                            this.clerkjs && this.loaded ? this.clerkjs.closeSignUp() : this.preopenSignUp = null
                        }, this.mountSignIn = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountSignIn(e, t) : this.premountSignInNodes.set(e, t)
                        }, this.unmountSignIn = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountSignIn(e) : this.premountSignInNodes.delete(e)
                        }, this.mountSignUp = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountSignUp(e, t) : this.premountSignUpNodes.set(e, t)
                        }, this.unmountSignUp = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountSignUp(e) : this.premountSignUpNodes.delete(e)
                        }, this.mountUserProfile = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountUserProfile(e, t) : this.premountUserProfileNodes.set(e, t)
                        }, this.unmountUserProfile = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountUserProfile(e) : this.premountUserProfileNodes.delete(e)
                        }, this.mountOrganizationProfile = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountOrganizationProfile(e, t) : this.premountOrganizationProfileNodes.set(e, t)
                        }, this.unmountOrganizationProfile = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountOrganizationProfile(e) : this.premountOrganizationProfileNodes.delete(e)
                        }, this.mountCreateOrganization = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountCreateOrganization(e, t) : this.premountCreateOrganizationNodes.set(e, t)
                        }, this.unmountCreateOrganization = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountCreateOrganization(e) : this.premountCreateOrganizationNodes.delete(e)
                        }, this.mountOrganizationSwitcher = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountOrganizationSwitcher(e, t) : this.premountOrganizationSwitcherNodes.set(e, t)
                        }, this.unmountOrganizationSwitcher = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountOrganizationSwitcher(e) : this.premountOrganizationSwitcherNodes.delete(e)
                        }, this.__experimental_prefetchOrganizationSwitcher = () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.__experimental_prefetchOrganizationSwitcher()
                            };
                            this.clerkjs && this.loaded ? e() : this.premountMethodCalls.set("__experimental_prefetchOrganizationSwitcher", e)
                        }, this.mountOrganizationList = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountOrganizationList(e, t) : this.premountOrganizationListNodes.set(e, t)
                        }, this.unmountOrganizationList = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountOrganizationList(e) : this.premountOrganizationListNodes.delete(e)
                        }, this.mountUserButton = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountUserButton(e, t) : this.premountUserButtonNodes.set(e, t)
                        }, this.unmountUserButton = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountUserButton(e) : this.premountUserButtonNodes.delete(e)
                        }, this.mountWaitlist = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountWaitlist(e, t) : this.premountWaitlistNodes.set(e, t)
                        }, this.unmountWaitlist = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountWaitlist(e) : this.premountWaitlistNodes.delete(e)
                        }, this.mountPricingTable = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountPricingTable(e, t) : this.premountPricingTableNodes.set(e, t)
                        }, this.unmountPricingTable = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountPricingTable(e) : this.premountPricingTableNodes.delete(e)
                        }, this.mountApiKeys = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.mountApiKeys(e, t) : this.premountApiKeysNodes.set(e, t)
                        }, this.unmountApiKeys = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.unmountApiKeys(e) : this.premountApiKeysNodes.delete(e)
                        }, this.__internal_mountOAuthConsent = (e, t) => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_mountOAuthConsent(e, t) : this.premountOAuthConsentNodes.set(e, t)
                        }, this.__internal_unmountOAuthConsent = e => {
                            this.clerkjs && this.loaded ? this.clerkjs.__internal_unmountOAuthConsent(e) : this.premountOAuthConsentNodes.delete(e)
                        }, this.addListener = e => {
                            if (this.clerkjs) return this.clerkjs.addListener(e); {
                                let t = () => {
                                    var t;
                                    let r = this.premountAddListenerCalls.get(e);
                                    r && (null == (t = r.nativeUnsubscribe) || t.call(r), this.premountAddListenerCalls.delete(e))
                                };
                                return this.premountAddListenerCalls.set(e, {
                                    unsubscribe: t,
                                    nativeUnsubscribe: void 0
                                }), t
                            }
                        }, this.navigate = e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.navigate(e)
                            };
                            this.clerkjs && this.loaded ? t() : this.premountMethodCalls.set("navigate", t)
                        }, this.redirectWithAuth = async (...e) => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.redirectWithAuth(...e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("redirectWithAuth", t)
                        }, this.redirectToSignIn = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.redirectToSignIn(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("redirectToSignIn", t)
                        }, this.redirectToSignUp = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.redirectToSignUp(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("redirectToSignUp", t)
                        }, this.redirectToUserProfile = async () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToUserProfile()
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("redirectToUserProfile", e)
                        }, this.redirectToAfterSignUp = () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToAfterSignUp()
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("redirectToAfterSignUp", e)
                        }, this.redirectToAfterSignIn = () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToAfterSignIn()
                            };
                            this.clerkjs && this.loaded ? e() : this.premountMethodCalls.set("redirectToAfterSignIn", e)
                        }, this.redirectToAfterSignOut = () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToAfterSignOut()
                            };
                            this.clerkjs && this.loaded ? e() : this.premountMethodCalls.set("redirectToAfterSignOut", e)
                        }, this.redirectToOrganizationProfile = async () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToOrganizationProfile()
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("redirectToOrganizationProfile", e)
                        }, this.redirectToCreateOrganization = async () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToCreateOrganization()
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("redirectToCreateOrganization", e)
                        }, this.redirectToWaitlist = async () => {
                            let e = () => {
                                var e;
                                return null == (e = this.clerkjs) ? void 0 : e.redirectToWaitlist()
                            };
                            if (this.clerkjs && this.loaded) return e();
                            this.premountMethodCalls.set("redirectToWaitlist", e)
                        }, this.handleRedirectCallback = async e => {
                            var t;
                            let r = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.handleRedirectCallback(e)
                            };
                            this.clerkjs && this.loaded ? null == (t = r()) || t.catch(() => {}) : this.premountMethodCalls.set("handleRedirectCallback", r)
                        }, this.handleGoogleOneTapCallback = async (e, t) => {
                            var r;
                            let n = () => {
                                var r;
                                return null == (r = this.clerkjs) ? void 0 : r.handleGoogleOneTapCallback(e, t)
                            };
                            this.clerkjs && this.loaded ? null == (r = n()) || r.catch(() => {}) : this.premountMethodCalls.set("handleGoogleOneTapCallback", n)
                        }, this.handleEmailLinkVerification = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.handleEmailLinkVerification(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("handleEmailLinkVerification", t)
                        }, this.authenticateWithMetamask = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.authenticateWithMetamask(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("authenticateWithMetamask", t)
                        }, this.authenticateWithCoinbaseWallet = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.authenticateWithCoinbaseWallet(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("authenticateWithCoinbaseWallet", t)
                        }, this.authenticateWithOKXWallet = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.authenticateWithOKXWallet(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("authenticateWithOKXWallet", t)
                        }, this.authenticateWithWeb3 = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.authenticateWithWeb3(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("authenticateWithWeb3", t)
                        }, this.authenticateWithGoogleOneTap = async e => (await v(this, u, c).call(this)).authenticateWithGoogleOneTap(e), this.__internal_loadStripeJs = async () => (await v(this, u, c).call(this)).__internal_loadStripeJs(), this.createOrganization = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.createOrganization(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("createOrganization", t)
                        }, this.getOrganization = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.getOrganization(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("getOrganization", t)
                        }, this.joinWaitlist = async e => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.joinWaitlist(e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("joinWaitlist", t)
                        }, this.signOut = async (...e) => {
                            let t = () => {
                                var t;
                                return null == (t = this.clerkjs) ? void 0 : t.signOut(...e)
                            };
                            if (this.clerkjs && this.loaded) return t();
                            this.premountMethodCalls.set("signOut", t)
                        };
                        let {
                            Clerk: t = null,
                            publishableKey: r
                        } = e || {};
                        m(this, s, r), m(this, o, null == e ? void 0 : e.proxyUrl), m(this, i, null == e ? void 0 : e.domain), this.options = e, this.Clerk = t, this.mode = (0, E._f)() ? "browser" : "server", this.options.sdkMetadata || (this.options.sdkMetadata = eM), f(this, l).emit(L.Status, "loading"), f(this, l).prioritizedOn(L.Status, e => m(this, n, e)), f(this, s) && this.loadClerkJS()
                    }
                    get publishableKey() {
                        return f(this, s)
                    }
                    get loaded() {
                        var e;
                        return (null == (e = this.clerkjs) ? void 0 : e.loaded) || !1
                    }
                    get status() {
                        var e;
                        return this.clerkjs ? (null == (e = this.clerkjs) ? void 0 : e.status) || (this.clerkjs.loaded ? "ready" : "loading") : f(this, n)
                    }
                    static getOrCreateInstance(t) {
                        return (0, E._f)() && f(this, a) && (!t.Clerk || f(this, a).Clerk === t.Clerk) && f(this, a).publishableKey === t.publishableKey || m(this, a, new e(t)), f(this, a)
                    }
                    static clearInstance() {
                        m(this, a, null)
                    }
                    get domain() {
                        return "undefined" != typeof window && window.location ? (0, y.YZ)(f(this, i), new URL(window.location.href), "") : "function" == typeof f(this, i) ? d.RM.throw(d.qq) : f(this, i) || ""
                    }
                    get proxyUrl() {
                        return "undefined" != typeof window && window.location ? (0, y.YZ)(f(this, o), new URL(window.location.href), "") : "function" == typeof f(this, o) ? d.RM.throw(d.qq) : f(this, o) || ""
                    }
                    __internal_getOption(e) {
                        var t, r;
                        return (null == (t = this.clerkjs) ? void 0 : t.__internal_getOption) ? null == (r = this.clerkjs) ? void 0 : r.__internal_getOption(e) : this.options[e]
                    }
                    get sdkMetadata() {
                        var e;
                        return (null == (e = this.clerkjs) ? void 0 : e.sdkMetadata) || this.options.sdkMetadata || void 0
                    }
                    get instanceType() {
                        var e;
                        return null == (e = this.clerkjs) ? void 0 : e.instanceType
                    }
                    get frontendApi() {
                        var e;
                        return (null == (e = this.clerkjs) ? void 0 : e.frontendApi) || ""
                    }
                    get isStandardBrowser() {
                        var e;
                        return (null == (e = this.clerkjs) ? void 0 : e.isStandardBrowser) || this.options.standardBrowser || !1
                    }
                    get isSatellite() {
                        return "undefined" != typeof window && window.location ? (0, y.YZ)(this.options.isSatellite, new URL(window.location.href), !1) : "function" == typeof this.options.isSatellite && d.RM.throw(d.qq)
                    }
                    async loadClerkJS() {
                        var e, t;
                        if ("browser" === this.mode && !this.loaded) {
                            "undefined" != typeof window && (window.__clerk_publishable_key = f(this, s), window.__clerk_proxy_url = this.proxyUrl, window.__clerk_domain = this.domain);
                            try {
                                if (this.Clerk) {
                                    let e;
                                    (t = this.Clerk, "function" == typeof t) ? (e = new this.Clerk(f(this, s), {
                                        proxyUrl: this.proxyUrl,
                                        domain: this.domain
                                    }), this.beforeLoad(e), await e.load(this.options)) : (e = this.Clerk).loaded || (this.beforeLoad(e), await e.load(this.options)), global.Clerk = e
                                } else if (!__BUILD_DISABLE_RHC__) {
                                    if (global.Clerk || await (0, k.YJ)({ ...this.options,
                                            publishableKey: f(this, s),
                                            proxyUrl: this.proxyUrl,
                                            domain: this.domain,
                                            nonce: this.options.nonce
                                        }), !global.Clerk) throw Error("Failed to download latest ClerkJS. Contact support@clerk.com.");
                                    this.beforeLoad(global.Clerk), await global.Clerk.load(this.options)
                                }
                                if (null == (e = global.Clerk) ? void 0 : e.loaded) return this.hydrateClerkJS(global.Clerk);
                                return
                            } catch (e) {
                                f(this, l).emit(L.Status, "error"), console.error(e.stack || e.message || e);
                                return
                            }
                        }
                    }
                    get version() {
                        var e;
                        return null == (e = this.clerkjs) ? void 0 : e.version
                    }
                    get client() {
                        return this.clerkjs ? this.clerkjs.client : void 0
                    }
                    get session() {
                        return this.clerkjs ? this.clerkjs.session : void 0
                    }
                    get user() {
                        return this.clerkjs ? this.clerkjs.user : void 0
                    }
                    get organization() {
                        return this.clerkjs ? this.clerkjs.organization : void 0
                    }
                    get telemetry() {
                        return this.clerkjs ? this.clerkjs.telemetry : void 0
                    }
                    get __unstable__environment() {
                        return this.clerkjs ? this.clerkjs.__unstable__environment : void 0
                    }
                    get isSignedIn() {
                        return !!this.clerkjs && this.clerkjs.isSignedIn
                    }
                    get billing() {
                        var e;
                        return null == (e = this.clerkjs) ? void 0 : e.billing
                    }
                    get apiKeys() {
                        var e;
                        return null == (e = this.clerkjs) ? void 0 : e.apiKeys
                    }
                    __unstable__setEnvironment(...e) {
                        this.clerkjs && "__unstable__setEnvironment" in this.clerkjs && this.clerkjs.__unstable__setEnvironment(e)
                    }
                };

            function eI(e) {
                let {
                    isomorphicClerkOptions: t,
                    initialState: r,
                    children: n
                } = e, {
                    isomorphicClerk: i,
                    clerkStatus: o
                } = eL(t), [s, l] = b.useState({
                    client: i.client,
                    session: i.session,
                    user: i.user,
                    organization: i.organization
                });
                b.useEffect(() => i.addListener(e => l({ ...e
                })), []);
                let a = C(i.loaded, s, r),
                    u = b.useMemo(() => ({
                        value: i
                    }), [o]),
                    c = b.useMemo(() => ({
                        value: s.client
                    }), [s.client]),
                    {
                        sessionId: p,
                        sessionStatus: h,
                        sessionClaims: f,
                        session: g,
                        userId: m,
                        user: v,
                        orgId: k,
                        actor: y,
                        organization: _,
                        orgRole: S,
                        orgSlug: w,
                        orgPermissions: j,
                        factorVerificationAge: O
                    } = a,
                    E = b.useMemo(() => ({
                        value: {
                            sessionId: p,
                            sessionStatus: h,
                            sessionClaims: f,
                            userId: m,
                            actor: y,
                            orgId: k,
                            orgRole: S,
                            orgSlug: w,
                            orgPermissions: j,
                            factorVerificationAge: O
                        }
                    }), [p, h, m, y, k, S, w, O, null == f ? void 0 : f.__raw]),
                    U = b.useMemo(() => ({
                        value: g
                    }), [p, g]),
                    M = b.useMemo(() => ({
                        value: v
                    }), [m, v]),
                    z = b.useMemo(() => ({
                        value: {
                            organization: _
                        }
                    }), [k, _]);
                return b.createElement(d.iz.Provider, {
                    value: u
                }, b.createElement(P.RY.Provider, {
                    value: c
                }, b.createElement(P.B3.Provider, {
                    value: U
                }, b.createElement(P.f0, { ...z.value
                }, b.createElement(d.Vo.Provider, {
                    value: E
                }, b.createElement(P.St.Provider, {
                    value: M
                }, b.createElement(P.hA, {
                    value: void 0
                }, n)))))))
            }
            n = new WeakMap, i = new WeakMap, o = new WeakMap, s = new WeakMap, l = new WeakMap, a = new WeakMap, u = new WeakSet, c = function() {
                return new Promise(e => {
                    this.addOnLoaded(() => e(this.clerkjs))
                })
            }, g(ez, a);
            var eL = e => {
                    let t = b.useRef(ez.getOrCreateInstance(e)),
                        [r, n] = b.useState(t.current.status);
                    return b.useEffect(() => {
                        t.current.__unstable__updateProps({
                            appearance: e.appearance
                        })
                    }, [e.appearance]), b.useEffect(() => {
                        t.current.__unstable__updateProps({
                            options: e
                        })
                    }, [e.localization]), b.useEffect(() => (t.current.on("status", n), () => {
                        t.current && t.current.off("status", n), ez.clearInstance()
                    }), []), {
                        isomorphicClerk: t.current,
                        clerkStatus: r
                    }
                },
                eA = function(e, t, r) {
                    let n = e.displayName || e.name || t || "Component",
                        i = n => (! function(e, t, r = 1) {
                            b.useEffect(() => {
                                let n = x.get(e) || 0;
                                return n == r ? d.RM.throw(t) : (x.set(e, n + 1), () => {
                                    x.set(e, (x.get(e) || 1) - 1)
                                })
                            }, [])
                        }(t, r), b.createElement(e, { ...n
                        }));
                    return i.displayName = `withMaxAllowedInstancesGuard(${n})`, i
                }(function(e) {
                    let {
                        initialState: t,
                        children: r,
                        __internal_bypassMissingPublishableKey: n,
                        ...i
                    } = e, {
                        publishableKey: o = "",
                        Clerk: s
                    } = i;
                    return s || n || (o ? o && !(0, w.x9)(o) && d.RM.throwInvalidPublishableKeyError({
                        key: o
                    }) : d.RM.throwMissingPublishableKeyError()), b.createElement(eI, {
                        initialState: t,
                        isomorphicClerkOptions: i
                    }, r)
                }, "ClerkProvider", d.KQ);
            eA.displayName = "ClerkProvider", (0, d.JM)({
                packageName: "@clerk/clerk-react"
            }), (0, k.Aw)("@clerk/clerk-react")
        },
        86085: function(e, t, r) {
            "use strict";

            function n() {
                return "undefined" != typeof window
            }
            r.d(t, {
                _f: function() {
                    return n
                }
            }), RegExp("bot|spider|crawl|APIs-Google|AdsBot|Googlebot|mediapartners|Google Favicon|FeedFetcher|Google-Read-Aloud|DuplexWeb-Google|googleweblight|bing|yandex|baidu|duckduck|yahoo|ecosia|ia_archiver|facebook|instagram|pinterest|reddit|slack|twitter|whatsapp|youtube|semrush", "i"), r(87732)
        },
        9346: function(e, t, r) {
            "use strict";

            function n(e) {
                return "clerkError" in e
            }
            r.d(t, {
                kD: function() {
                    return n
                },
                t5: function() {
                    return s
                },
                w$: function() {
                    return i
                }
            });
            var i = class e extends Error {
                    constructor(t, {
                        code: r
                    }) {
                        let n = "\uD83D\uDD12 Clerk:",
                            i = RegExp(n.replace(" ", "\\s*"), "i"),
                            o = t.replace(i, ""),
                            s = `${n} ${o.trim()}

(code="${r}")
`;
                        super(s), this.toString = () => `[${this.name}]
Message:${this.message}`, Object.setPrototypeOf(this, e.prototype), this.code = r, this.message = s, this.clerkRuntimeError = !0, this.name = "ClerkRuntimeError"
                    }
                },
                o = Object.freeze({
                    InvalidProxyUrlErrorMessage: "The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})",
                    InvalidPublishableKeyErrorMessage: "The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})",
                    MissingPublishableKeyErrorMessage: "Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.",
                    MissingSecretKeyErrorMessage: "Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.",
                    MissingClerkProvider: "{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider"
                });

            function s({
                packageName: e,
                customMessages: t
            }) {
                let r = e;

                function n(e, t) {
                    if (!t) return `${r}: ${e}`;
                    let n = e;
                    for (let r of e.matchAll(/{{([a-zA-Z0-9-_]+)}}/g)) {
                        let e = (t[r[1]] || "").toString();
                        n = n.replace(`{{${r[1]}}}`, e)
                    }
                    return `${r}: ${n}`
                }
                let i = { ...o,
                    ...t
                };
                return {
                    setPackageName({
                        packageName: e
                    }) {
                        return "string" == typeof e && (r = e), this
                    },
                    setMessages({
                        customMessages: e
                    }) {
                        return Object.assign(i, e || {}), this
                    },
                    throwInvalidPublishableKeyError(e) {
                        throw Error(n(i.InvalidPublishableKeyErrorMessage, e))
                    },
                    throwInvalidProxyUrl(e) {
                        throw Error(n(i.InvalidProxyUrlErrorMessage, e))
                    },
                    throwMissingPublishableKeyError() {
                        throw Error(n(i.MissingPublishableKeyErrorMessage))
                    },
                    throwMissingSecretKeyError() {
                        throw Error(n(i.MissingSecretKeyErrorMessage))
                    },
                    throwMissingClerkProviderError(e) {
                        throw Error(n(i.MissingClerkProvider, e))
                    },
                    throw (e) {
                        throw Error(n(e))
                    }
                }
            }
        },
        27626: function(e, t, r) {
            "use strict";
            r.d(t, {
                Pm: function() {
                    return f
                },
                QL: function() {
                    return m
                },
                qB: function() {
                    return v
                }
            });
            var n = {
                    strict_mfa: {
                        afterMinutes: 10,
                        level: "multi_factor"
                    },
                    strict: {
                        afterMinutes: 10,
                        level: "second_factor"
                    },
                    moderate: {
                        afterMinutes: 60,
                        level: "second_factor"
                    },
                    lax: {
                        afterMinutes: 1440,
                        level: "second_factor"
                    }
                },
                i = new Set(["first_factor", "second_factor", "multi_factor"]),
                o = new Set(["strict_mfa", "strict", "moderate", "lax"]),
                s = e => "number" == typeof e && e > 0,
                l = e => i.has(e),
                a = e => o.has(e),
                u = e => e.replace(/^(org:)*/, "org:"),
                c = (e, t) => {
                    let {
                        orgId: r,
                        orgRole: n,
                        orgPermissions: i
                    } = t;
                    return (e.role || e.permission) && r && n && i ? e.permission ? i.includes(u(e.permission)) : e.role ? u(n) === u(e.role) : null : null
                },
                d = (e, t) => {
                    let {
                        org: r,
                        user: n
                    } = h(e), [i, o] = t.split(":"), s = o || i;
                    return "org" === i ? r.includes(s) : "user" === i ? n.includes(s) : [...r, ...n].includes(s)
                },
                p = (e, t) => {
                    let {
                        features: r,
                        plans: n
                    } = t;
                    return e.feature && r ? d(r, e.feature) : e.plan && n ? d(n, e.plan) : null
                },
                h = e => {
                    let t = e ? e.split(",").map(e => e.trim()) : [];
                    return {
                        org: t.filter(e => e.split(":")[0].includes("o")).map(e => e.split(":")[1]),
                        user: t.filter(e => e.split(":")[0].includes("u")).map(e => e.split(":")[1])
                    }
                },
                f = e => {
                    if (!e) return !1;
                    let t = "string" == typeof e && a(e),
                        r = "object" == typeof e && l(e.level) && s(e.afterMinutes);
                    return (!!t || !!r) && (e => "string" == typeof e ? n[e] : e).bind(null, e)
                },
                g = (e, {
                    factorVerificationAge: t
                }) => {
                    if (!e.reverification || !t) return null;
                    let r = f(e.reverification);
                    if (!r) return null;
                    let {
                        level: n,
                        afterMinutes: i
                    } = r(), [o, s] = t, l = -1 !== o ? i > o : null, a = -1 !== s ? i > s : null;
                    switch (n) {
                        case "first_factor":
                            return l;
                        case "second_factor":
                            return -1 !== s ? a : l;
                        case "multi_factor":
                            return -1 === s ? l : l && a
                    }
                },
                m = e => t => {
                    if (!e.userId) return !1;
                    let r = p(t, e),
                        n = c(t, e),
                        i = g(t, e);
                    return [r || n, i].some(e => null === e) ? [r || n, i].some(e => !0 === e) : [r || n, i].every(e => !0 === e)
                },
                v = ({
                    authObject: {
                        sessionId: e,
                        sessionStatus: t,
                        userId: r,
                        actor: n,
                        orgId: i,
                        orgRole: o,
                        orgSlug: s,
                        signOut: l,
                        getToken: a,
                        has: u,
                        sessionClaims: c
                    },
                    options: {
                        treatPendingAsSignedOut: d = !0
                    }
                }) => void 0 === e && void 0 === r ? {
                    isLoaded: !1,
                    isSignedIn: void 0,
                    sessionId: e,
                    sessionClaims: void 0,
                    userId: r,
                    actor: void 0,
                    orgId: void 0,
                    orgRole: void 0,
                    orgSlug: void 0,
                    has: void 0,
                    signOut: l,
                    getToken: a
                } : null === e && null === r ? {
                    isLoaded: !0,
                    isSignedIn: !1,
                    sessionId: e,
                    userId: r,
                    sessionClaims: null,
                    actor: null,
                    orgId: null,
                    orgRole: null,
                    orgSlug: null,
                    has: () => !1,
                    signOut: l,
                    getToken: a
                } : d && "pending" === t ? {
                    isLoaded: !0,
                    isSignedIn: !1,
                    sessionId: null,
                    userId: null,
                    sessionClaims: null,
                    actor: null,
                    orgId: null,
                    orgRole: null,
                    orgSlug: null,
                    has: () => !1,
                    signOut: l,
                    getToken: a
                } : e && c && r && i && o ? {
                    isLoaded: !0,
                    isSignedIn: !0,
                    sessionId: e,
                    sessionClaims: c,
                    userId: r,
                    actor: n || null,
                    orgId: i,
                    orgRole: o,
                    orgSlug: s || null,
                    has: u,
                    signOut: l,
                    getToken: a
                } : e && c && r && !i ? {
                    isLoaded: !0,
                    isSignedIn: !0,
                    sessionId: e,
                    sessionClaims: c,
                    userId: r,
                    actor: n || null,
                    orgId: null,
                    orgRole: null,
                    orgSlug: null,
                    has: u,
                    signOut: l,
                    getToken: a
                } : void 0
        },
        87732: function(e, t, r) {
            "use strict";
            r.d(t, {
                U9: function() {
                    return f
                },
                ac: function() {
                    return p
                },
                qx: function() {
                    return h
                },
                r2: function() {
                    return a
                },
                yA: function() {
                    return c
                }
            });
            var n = Object.defineProperty,
                i = Object.getOwnPropertyDescriptor,
                o = Object.getOwnPropertyNames,
                s = Object.prototype.hasOwnProperty,
                l = e => {
                    throw TypeError(e)
                },
                a = (e, t) => {
                    for (var r in t) n(e, r, {
                        get: t[r],
                        enumerable: !0
                    })
                },
                u = (e, t, r, l) => {
                    if (t && "object" == typeof t || "function" == typeof t)
                        for (let a of o(t)) s.call(e, a) || a === r || n(e, a, {
                            get: () => t[a],
                            enumerable: !(l = i(t, a)) || l.enumerable
                        });
                    return e
                },
                c = (e, t, r) => (u(e, t, "default"), r && u(r, t, "default")),
                d = (e, t, r) => t.has(e) || l("Cannot " + r),
                p = (e, t, r) => (d(e, t, "read from private field"), r ? r.call(e) : t.get(e)),
                h = (e, t, r, n) => (d(e, t, "write to private field"), n ? n.call(e, r) : t.set(e, r), r),
                f = (e, t, r) => (d(e, t, "access private method"), r)
        },
        62350: function(e, t, r) {
            "use strict";
            r.d(t, {
                rx: function() {
                    return o
                },
                uB: function() {
                    return i
                },
                vf: function() {
                    return n
                }
            });
            var n = () => !1,
                i = () => !1,
                o = () => {
                    try {
                        return !0
                    } catch {}
                    return !1
                }
        },
        65053: function(e, t, r) {
            "use strict";
            r.d(t, {
                fQ: function() {
                    return i
                }
            });
            var n = e => {
                let t = r => {
                    if (!r) return r;
                    if (Array.isArray(r)) return r.map(e => "object" == typeof e || Array.isArray(e) ? t(e) : e);
                    let n = { ...r
                    };
                    for (let r of Object.keys(n)) {
                        let i = e(r.toString());
                        i !== r && (n[i] = n[r], delete n[r]), "object" == typeof n[i] && (n[i] = t(n[i]))
                    }
                    return n
                };
                return t
            };

            function i(e) {
                if ("boolean" == typeof e) return e;
                if (null == e) return !1;
                if ("string" == typeof e) {
                    if ("true" === e.toLowerCase()) return !0;
                    if ("false" === e.toLowerCase()) return !1
                }
                let t = parseInt(e, 10);
                return !isNaN(t) && t > 0
            }
            n(function(e) {
                return e ? e.replace(/[A-Z]/g, e => `_${e.toLowerCase()}`) : ""
            }), n(function(e) {
                return e ? e.replace(/([-_][a-z])/g, e => e.toUpperCase().replace(/-|_/, "")) : ""
            })
        },
        80319: function(e, t, r) {
            "use strict";
            r.d(t, {
                Fo: function() {
                    return l
                },
                Iq: function() {
                    return a
                },
                Xv: function() {
                    return u
                },
                cM: function() {
                    return s
                },
                iF: function() {
                    return o
                },
                mv: function() {
                    return n
                },
                vO: function() {
                    return i
                }
            });
            var n = [".lcl.dev", ".lclstage.dev", ".lclclerk.com"],
                i = [".lcl.dev", ".stg.dev", ".lclstage.dev", ".stgstage.dev", ".dev.lclclerk.com", ".stg.lclclerk.com", ".accounts.lclclerk.com", "accountsstage.dev", "accounts.dev"],
                o = [".lcl.dev", "lclstage.dev", ".lclclerk.com", ".accounts.lclclerk.com"],
                s = [".accountsstage.dev"],
                l = "https://api.lclclerk.com",
                a = "https://api.clerkstage.dev",
                u = "https://api.clerk.com"
        },
        9152: function(e, t, r) {
            "use strict";
            r.d(t, {
                MY: function() {
                    return u
                },
                x9: function() {
                    return a
                },
                nQ: function() {
                    return l
                }
            });
            var n = e => "undefined" != typeof atob && "function" == typeof atob ? atob(e) : "undefined" != typeof global && global.Buffer ? new global.Buffer(e, "base64").toString() : e,
                i = r(80319),
                o = "pk_live_";

            function s(e) {
                if (!e.endsWith("$")) return !1;
                let t = e.slice(0, -1);
                return !t.includes("$") && t.includes(".")
            }

            function l(e, t = {}) {
                let r;
                if (!(e = e || "") || !a(e)) {
                    if (t.fatal && !e) throw Error("Publishable key is missing. Ensure that your publishable key is correctly configured. Double-check your environment configuration for your keys, or access them here: https://dashboard.clerk.com/last-active?path=api-keys");
                    if (t.fatal && !a(e)) throw Error("Publishable key not valid.");
                    return null
                }
                let i = e.startsWith(o) ? "production" : "development";
                try {
                    r = n(e.split("_")[2])
                } catch {
                    if (t.fatal) throw Error("Publishable key not valid: Failed to decode key.");
                    return null
                }
                if (!s(r)) {
                    if (t.fatal) throw Error("Publishable key not valid: Decoded key has invalid format.");
                    return null
                }
                let l = r.slice(0, -1);
                return t.proxyUrl ? l = t.proxyUrl : "development" !== i && t.domain && t.isSatellite && (l = `clerk.${t.domain}`), {
                    instanceType: i,
                    frontendApi: l
                }
            }

            function a(e = "") {
                try {
                    if (!(e.startsWith(o) || e.startsWith("pk_test_"))) return !1;
                    let t = e.split("_");
                    if (3 !== t.length) return !1;
                    let r = t[2];
                    if (!r) return !1;
                    let i = n(r);
                    return s(i)
                } catch {
                    return !1
                }
            }

            function u() {
                let e = new Map;
                return {
                    isDevOrStagingUrl: t => {
                        if (!t) return !1;
                        let r = "string" == typeof t ? t : t.hostname,
                            n = e.get(r);
                        return void 0 === n && (n = i.vO.some(e => r.endsWith(e)), e.set(r, n)), n
                    }
                }
            }
        },
        30226: function(e, t, r) {
            "use strict";
            var n, i, o, s;

            function l(e, t) {
                return {
                    event: "METHOD_CALLED",
                    payload: {
                        method: e,
                        ...t
                    }
                }
            }

            function a(e) {
                return {
                    event: "FRAMEWORK_METADATA",
                    eventSamplingRate: .1,
                    payload: e
                }
            }
            r.d(t, {
                J6: function() {
                    return l
                },
                kD: function() {
                    return a
                }
            }), r(65053), r(87732), r(72044), new WeakMap, new WeakMap, new WeakSet, new WeakMap, new WeakMap, new WeakMap, new WeakMap, new WeakMap, new WeakSet
        },
        6210: function(e, t, r) {
            "use strict";
            r.d(t, {
                t5: function() {
                    return n.t5
                }
            });
            var n = r(9346);
            r(87732)
        },
        82467: function(e, t, r) {
            "use strict";
            r.d(t, {
                iv: function() {
                    return P
                },
                wE: function() {
                    return S
                },
                YJ: function() {
                    return _
                },
                Aw: function() {
                    return k
                }
            });
            var n = (e, t = "5.75.0") => {
                    if (e) return e;
                    let r = i(t);
                    return r ? "snapshot" === r ? "5.75.0" : r : o(t)
                },
                i = e => e.trim().replace(/^v/, "").match(/-(.+?)(\.|$)/) ? .[1],
                o = e => e.trim().replace(/^v/, "").split(".")[0];

            function s(e) {
                return e.startsWith("/")
            }
            var l = {
                    initialDelay: 125,
                    maxDelayBetweenRetries: 0,
                    factor: 2,
                    shouldRetry: (e, t) => t < 5,
                    retryImmediately: !1,
                    jitter: !0
                },
                a = async e => new Promise(t => setTimeout(t, e)),
                u = (e, t) => t ? e * (1 + Math.random()) : e,
                c = e => {
                    let t = 0,
                        r = () => {
                            let r = e.initialDelay * Math.pow(e.factor, t);
                            return r = u(r, e.jitter), Math.min(e.maxDelayBetweenRetries || r, r)
                        };
                    return async () => {
                        await a(r()), t++
                    }
                },
                d = async (e, t = {}) => {
                    let r = 0,
                        {
                            shouldRetry: n,
                            initialDelay: i,
                            maxDelayBetweenRetries: o,
                            factor: s,
                            retryImmediately: d,
                            jitter: p
                        } = { ...l,
                            ...t
                        },
                        h = c({
                            initialDelay: i,
                            maxDelayBetweenRetries: o,
                            factor: s,
                            jitter: p
                        });
                    for (;;) try {
                        return await e()
                    } catch (e) {
                        if (!n(e, ++r)) throw e;
                        d && 1 === r ? await a(u(100, p)) : await h()
                    }
                };
            async function p(e = "", t) {
                let {
                    async: r,
                    defer: n,
                    beforeLoad: i,
                    crossOrigin: o,
                    nonce: s
                } = t || {};
                return d(() => new Promise((t, l) => {
                    e || l(Error("loadScript cannot be called without a src")), document && document.body || l("loadScript cannot be called when document does not exist");
                    let a = document.createElement("script");
                    o && a.setAttribute("crossorigin", o), a.async = r || !1, a.defer = n || !1, a.addEventListener("load", () => {
                        a.remove(), t(a)
                    }), a.addEventListener("error", () => {
                        a.remove(), l()
                    }), a.src = e, a.nonce = s, i ? .(a), document.body.appendChild(a)
                }), {
                    shouldRetry: (e, t) => t <= 5
                })
            }
            var h = r(9346),
                f = r(9152),
                g = "Clerk: Failed to load Clerk",
                {
                    isDevOrStagingUrl: m
                } = (0, f.MY)(),
                v = (0, h.t5)({
                    packageName: "@clerk/shared"
                });

            function k(e) {
                v.setPackageName({
                    packageName: e
                })
            }

            function y() {
                if ("undefined" == typeof window || !window.Clerk) return !1;
                let e = window.Clerk;
                return "object" == typeof e && "function" == typeof e.load
            }

            function b(e) {
                return new Promise((t, r) => {
                    let n = !1,
                        i = (e, t) => {
                            clearTimeout(e), clearInterval(t)
                        },
                        o = () => {
                            !n && y() && (n = !0, i(s, l), t(null))
                        },
                        s = setTimeout(() => {
                            n || (n = !0, i(s, l), y() ? t(null) : r(Error(g)))
                        }, e);
                    o();
                    let l = setInterval(() => {
                        if (n) {
                            clearInterval(l);
                            return
                        }
                        o()
                    }, 100)
                })
            }
            var _ = async e => {
                    let t = e ? .scriptLoadTimeout ? ? 15e3;
                    if (y()) return null;
                    if (document.querySelector("script[data-clerk-js-script]")) return b(t);
                    if (!e ? .publishableKey) return v.throwMissingPublishableKeyError(), null;
                    let r = b(t);
                    return p(S(e), {
                        async: !0,
                        crossOrigin: "anonymous",
                        nonce: e.nonce,
                        beforeLoad: w(e)
                    }).catch(() => {
                        throw Error(g)
                    }), r
                },
                S = e => {
                    let {
                        clerkJSUrl: t,
                        clerkJSVariant: r,
                        clerkJSVersion: i,
                        proxyUrl: o,
                        domain: l,
                        publishableKey: a
                    } = e;
                    if (t) return t;
                    let u = "";
                    u = o && (!o || /^http(s)?:\/\//.test(o || "") || s(o)) ? (o ? s(o) ? new URL(o, window.location.origin).toString() : o : "").replace(/http(s)?:\/\//, "") : l && !m(f.nQ(a) ? .frontendApi || "") ? function(e) {
                        let t;
                        if (!e) return "";
                        if (e.match(/^(clerk\.)+\w*$/)) t = /(clerk\.)*(?=clerk\.)/;
                        else {
                            if (e.match(/\.clerk.accounts/)) return e;
                            t = /^(clerk\.)*/gi
                        }
                        let r = e.replace(t, "");
                        return `clerk.${r}`
                    }(l) : f.nQ(a) ? .frontendApi || "";
                    let c = r ? `${r.replace(/\.+$/,"")}.` : "",
                        d = n(i);
                    return `https://${u}/npm/@clerk/clerk-js@${d}/dist/clerk.${c}browser.js`
                },
                P = e => {
                    let t = {};
                    return e.publishableKey && (t["data-clerk-publishable-key"] = e.publishableKey), e.proxyUrl && (t["data-clerk-proxy-url"] = e.proxyUrl), e.domain && (t["data-clerk-domain"] = e.domain), e.nonce && (t.nonce = e.nonce), t
                },
                w = e => t => {
                    let r = P(e);
                    for (let e in r) t.setAttribute(e, r[e])
                };
            r(87732)
        },
        24494: function(e, t, r) {
            "use strict";
            let n;
            r.d(t, {
                b5: function() {
                    return eX
                },
                RY: function() {
                    return e5
                },
                f0: function() {
                    return tr
                },
                B3: function() {
                    return e3
                },
                St: function() {
                    return e1
                },
                hA: function() {
                    return e9
                },
                Y7: function() {
                    return t3
                },
                pe: function() {
                    return t5
                },
                z4: function() {
                    return tw
                },
                Wh: function() {
                    return t4
                },
                uH: function() {
                    return eZ
                },
                c1: function() {
                    return tb
                },
                Rm: function() {
                    return tn
                },
                cL: function() {
                    return ty
                },
                rI: function() {
                    return e0
                },
                sX: function() {
                    return e6
                },
                o8: function() {
                    return tu
                },
                eW: function() {
                    return td
                },
                WZ: function() {
                    return tS
                },
                kP: function() {
                    return tf
                },
                xo: function() {
                    return tm
                },
                aF: function() {
                    return tk
                }
            });
            var i = {};
            r.r(i), r.d(i, {
                SWRConfig: function() {
                    return eE
                },
                default: function() {
                    return eU
                },
                mutate: function() {
                    return et
                },
                preload: function() {
                    return ec
                },
                unstable_serialize: function() {
                    return eC
                },
                useSWRConfig: function() {
                    return eu
                }
            });
            var o = r(30226),
                s = (...e) => {},
                l = () => {
                    let e = s,
                        t = s;
                    return {
                        promise: new Promise((r, n) => {
                            e = r, t = n
                        }),
                        resolve: e,
                        reject: t
                    }
                };
            r(65053);
            var a = r(9346),
                u = "reverification-error",
                c = e => ({
                    clerk_error: {
                        type: "forbidden",
                        reason: u,
                        metadata: {
                            reverification: e
                        }
                    }
                }),
                d = e => e && "object" == typeof e && "clerk_error" in e && e.clerk_error ? .type === "forbidden" && e.clerk_error ? .reason === u,
                p = r(27626),
                h = r(87732),
                f = r(55185),
                g = r(58413),
                m = Object.prototype.hasOwnProperty;
            let v = new WeakMap,
                k = () => {},
                y = k(),
                b = Object,
                _ = e => e === y,
                S = e => "function" == typeof e,
                P = (e, t) => ({ ...e,
                    ...t
                }),
                w = e => S(e.then),
                C = {},
                j = {},
                O = "undefined",
                E = typeof window != O,
                U = typeof document != O,
                M = E && "Deno" in window,
                z = () => E && typeof window.requestAnimationFrame != O,
                I = (e, t) => {
                    let r = v.get(e);
                    return [() => !_(t) && e.get(t) || C, n => {
                        if (!_(t)) {
                            let i = e.get(t);
                            t in j || (j[t] = i), r[5](t, P(i, n), i || C)
                        }
                    }, r[6], () => !_(t) && t in j ? j[t] : !_(t) && e.get(t) || C]
                },
                L = !0,
                [A, T] = E && window.addEventListener ? [window.addEventListener.bind(window), window.removeEventListener.bind(window)] : [k, k],
                R = {
                    initFocus: e => (U && document.addEventListener("visibilitychange", e), A("focus", e), () => {
                        U && document.removeEventListener("visibilitychange", e), T("focus", e)
                    }),
                    initReconnect: e => {
                        let t = () => {
                                L = !0, e()
                            },
                            r = () => {
                                L = !1
                            };
                        return A("online", t), A("offline", r), () => {
                            T("online", t), T("offline", r)
                        }
                    }
                },
                W = !f.useId,
                x = !E || M,
                D = e => z() ? window.requestAnimationFrame(e) : setTimeout(e, 1),
                N = x ? f.useEffect : f.useLayoutEffect,
                F = "undefined" != typeof navigator && navigator.connection,
                B = !x && F && (["slow-2g", "2g"].includes(F.effectiveType) || F.saveData),
                $ = new WeakMap,
                K = e => b.prototype.toString.call(e),
                J = (e, t) => e === "[object ".concat(t, "]"),
                q = 0,
                V = e => {
                    let t, r;
                    let n = typeof e,
                        i = K(e),
                        o = J(i, "Date"),
                        s = J(i, "RegExp"),
                        l = J(i, "Object");
                    if (b(e) !== e || o || s) t = o ? e.toJSON() : "symbol" == n ? e.toString() : "string" == n ? JSON.stringify(e) : "" + e;
                    else {
                        if (t = $.get(e)) return t;
                        if (t = ++q + "~", $.set(e, t), Array.isArray(e)) {
                            for (r = 0, t = "@"; r < e.length; r++) t += V(e[r]) + ",";
                            $.set(e, t)
                        }
                        if (l) {
                            t = "#";
                            let n = b.keys(e).sort();
                            for (; !_(r = n.pop());) _(e[r]) || (t += r + ":" + V(e[r]) + ",");
                            $.set(e, t)
                        }
                    }
                    return t
                },
                G = e => {
                    if (S(e)) try {
                        e = e()
                    } catch (t) {
                        e = ""
                    }
                    let t = e;
                    return [e = "string" == typeof e ? e : (Array.isArray(e) ? e.length : e) ? V(e) : "", t]
                },
                Y = 0,
                H = () => ++Y;
            async function Z() {
                for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                let [n, i, o, s] = t, l = P({
                    populateCache: !0,
                    throwOnError: !0
                }, "boolean" == typeof s ? {
                    revalidate: s
                } : s || {}), a = l.populateCache, u = l.rollbackOnError, c = l.optimisticData, d = e => "function" == typeof u ? u(e) : !1 !== u, p = l.throwOnError;
                if (S(i)) {
                    let e = [];
                    for (let t of n.keys()) !/^\$(inf|sub)\$/.test(t) && i(n.get(t)._k) && e.push(t);
                    return Promise.all(e.map(h))
                }
                return h(i);
                async function h(e) {
                    let r;
                    let [i] = G(e);
                    if (!i) return;
                    let [s, u] = I(n, i), [h, f, g, m] = v.get(n), k = () => {
                        let t = h[i];
                        return (S(l.revalidate) ? l.revalidate(s().data, e) : !1 !== l.revalidate) && (delete g[i], delete m[i], t && t[0]) ? t[0](2).then(() => s().data) : s().data
                    };
                    if (t.length < 3) return k();
                    let b = o,
                        P = !1,
                        C = H();
                    f[i] = [C, 0];
                    let j = !_(c),
                        O = s(),
                        E = O.data,
                        U = O._c,
                        M = _(U) ? E : U;
                    if (j && u({
                            data: c = S(c) ? c(M, E) : c,
                            _c: M
                        }), S(b)) try {
                        b = b(M)
                    } catch (e) {
                        r = e, P = !0
                    }
                    if (b && w(b)) {
                        if (b = await b.catch(e => {
                                r = e, P = !0
                            }), C !== f[i][0]) {
                            if (P) throw r;
                            return b
                        }
                        P && j && d(r) && (a = !0, u({
                            data: M,
                            _c: y
                        }))
                    }
                    if (a && !P && (S(a) ? u({
                            data: a(b, M),
                            error: y,
                            _c: y
                        }) : u({
                            data: b,
                            error: y,
                            _c: y
                        })), f[i][1] = H(), Promise.resolve(k()).then(() => {
                            u({
                                _c: y
                            })
                        }), P) {
                        if (p) throw r;
                        return
                    }
                    return b
                }
            }
            let Q = (e, t) => {
                    for (let r in e) e[r][0] && e[r][0](t)
                },
                X = (e, t) => {
                    if (!v.has(e)) {
                        let r = P(R, t),
                            n = Object.create(null),
                            i = Z.bind(y, e),
                            o = k,
                            s = Object.create(null),
                            l = (e, t) => {
                                let r = s[e] || [];
                                return s[e] = r, r.push(t), () => r.splice(r.indexOf(t), 1)
                            },
                            a = (t, r, n) => {
                                e.set(t, r);
                                let i = s[t];
                                if (i)
                                    for (let e of i) e(r, n)
                            },
                            u = () => {
                                if (!v.has(e) && (v.set(e, [n, Object.create(null), Object.create(null), Object.create(null), i, a, l]), !x)) {
                                    let t = r.initFocus(setTimeout.bind(y, Q.bind(y, n, 0))),
                                        i = r.initReconnect(setTimeout.bind(y, Q.bind(y, n, 1)));
                                    o = () => {
                                        t && t(), i && i(), v.delete(e)
                                    }
                                }
                            };
                        return u(), [e, i, u, o]
                    }
                    return [e, v.get(e)[4]]
                },
                [ee, et] = X(new Map),
                er = P({
                    onLoadingSlow: k,
                    onSuccess: k,
                    onError: k,
                    onErrorRetry: (e, t, r, n, i) => {
                        let o = r.errorRetryCount,
                            s = i.retryCount,
                            l = ~~((Math.random() + .5) * (1 << (s < 8 ? s : 8))) * r.errorRetryInterval;
                        (_(o) || !(s > o)) && setTimeout(n, l, i)
                    },
                    onDiscarded: k,
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    revalidateIfStale: !0,
                    shouldRetryOnError: !0,
                    errorRetryInterval: B ? 1e4 : 5e3,
                    focusThrottleInterval: 5e3,
                    dedupingInterval: 2e3,
                    loadingTimeout: B ? 5e3 : 3e3,
                    compare: function e(t, r) {
                        var n, i;
                        if (t === r) return !0;
                        if (t && r && (n = t.constructor) === r.constructor) {
                            if (n === Date) return t.getTime() === r.getTime();
                            if (n === RegExp) return t.toString() === r.toString();
                            if (n === Array) {
                                if ((i = t.length) === r.length)
                                    for (; i-- && e(t[i], r[i]););
                                return -1 === i
                            }
                            if (!n || "object" == typeof t) {
                                for (n in i = 0, t)
                                    if (m.call(t, n) && ++i && !m.call(r, n) || !(n in r) || !e(t[n], r[n])) return !1;
                                return Object.keys(r).length === i
                            }
                        }
                        return t != t && r != r
                    },
                    isPaused: () => !1,
                    cache: ee,
                    mutate: et,
                    fallback: {}
                }, {
                    isOnline: () => L,
                    isVisible: () => {
                        let e = U && document.visibilityState;
                        return _(e) || "hidden" !== e
                    }
                }),
                en = (e, t) => {
                    let r = P(e, t);
                    if (t) {
                        let {
                            use: n,
                            fallback: i
                        } = e, {
                            use: o,
                            fallback: s
                        } = t;
                        n && o && (r.use = n.concat(o)), i && s && (r.fallback = P(i, s))
                    }
                    return r
                },
                ei = (0, f.createContext)({}),
                eo = "$inf$",
                es = E && window.__SWR_DEVTOOLS_USE__,
                el = es ? window.__SWR_DEVTOOLS_USE__ : [],
                ea = e => S(e[1]) ? [e[0], e[1], e[2] || {}] : [e[0], null, (null === e[1] ? e[2] : e[1]) || {}],
                eu = () => P(er, (0, f.useContext)(ei)),
                ec = (e, t) => {
                    let [r, n] = G(e), [, , , i] = v.get(ee);
                    if (i[r]) return i[r];
                    let o = t(n);
                    return i[r] = o, o
                },
                ed = el.concat(e => (t, r, n) => {
                    let i = r && ((...e) => {
                        let [n] = G(t), [, , , i] = v.get(ee);
                        if (n.startsWith(eo)) return r(...e);
                        let o = i[n];
                        return _(o) ? r(...e) : (delete i[n], o)
                    });
                    return e(t, i, n)
                }),
                ep = (e, t, r) => {
                    let n = t[e] || (t[e] = []);
                    return n.push(r), () => {
                        let e = n.indexOf(r);
                        e >= 0 && (n[e] = n[n.length - 1], n.pop())
                    }
                },
                eh = (e, t) => (...r) => {
                    let [n, i, o] = ea(r), s = (o.use || []).concat(t);
                    return e(n, i, { ...o,
                        use: s
                    })
                };
            es && (window.__SWR_DEVTOOLS_REACT__ = f);
            let ef = () => {},
                eg = ef(),
                em = Object,
                ev = e => e === eg,
                ek = e => "function" == typeof e,
                ey = new WeakMap,
                eb = e => em.prototype.toString.call(e),
                e_ = (e, t) => e === `[object ${t}]`,
                eS = 0,
                eP = e => {
                    let t, r;
                    let n = typeof e,
                        i = eb(e),
                        o = e_(i, "Date"),
                        s = e_(i, "RegExp"),
                        l = e_(i, "Object");
                    if (em(e) !== e || o || s) t = o ? e.toJSON() : "symbol" == n ? e.toString() : "string" == n ? JSON.stringify(e) : "" + e;
                    else {
                        if (t = ey.get(e)) return t;
                        if (t = ++eS + "~", ey.set(e, t), Array.isArray(e)) {
                            for (r = 0, t = "@"; r < e.length; r++) t += eP(e[r]) + ",";
                            ey.set(e, t)
                        }
                        if (l) {
                            t = "#";
                            let n = em.keys(e).sort();
                            for (; !ev(r = n.pop());) ev(e[r]) || (t += r + ":" + eP(e[r]) + ",");
                            ey.set(e, t)
                        }
                    }
                    return t
                },
                ew = e => {
                    if (ek(e)) try {
                        e = e()
                    } catch (t) {
                        e = ""
                    }
                    let t = e;
                    return [e = "string" == typeof e ? e : (Array.isArray(e) ? e.length : e) ? eP(e) : "", t]
                },
                eC = e => ew(e)[0],
                ej = f.use || (e => {
                    switch (e.status) {
                        case "pending":
                            throw e;
                        case "fulfilled":
                            return e.value;
                        case "rejected":
                            throw e.reason;
                        default:
                            throw e.status = "pending", e.then(t => {
                                e.status = "fulfilled", e.value = t
                            }, t => {
                                e.status = "rejected", e.reason = t
                            }), e
                    }
                }),
                eO = {
                    dedupe: !0
                },
                eE = b.defineProperty(e => {
                    let {
                        value: t
                    } = e, r = (0, f.useContext)(ei), n = S(t), i = (0, f.useMemo)(() => n ? t(r) : t, [n, r, t]), o = (0, f.useMemo)(() => n ? i : en(r, i), [n, r, i]), s = i && i.provider, l = (0, f.useRef)(y);
                    s && !l.current && (l.current = X(s(o.cache || ee), i));
                    let a = l.current;
                    return a && (o.cache = a[0], o.mutate = a[1]), N(() => {
                        if (a) return a[2] && a[2](), a[3]
                    }, []), (0, f.createElement)(ei.Provider, P(e, {
                        value: o
                    }))
                }, "defaultValue", {
                    value: er
                }),
                eU = (n = (e, t, r) => {
                    let {
                        cache: n,
                        compare: i,
                        suspense: o,
                        fallbackData: s,
                        revalidateOnMount: l,
                        revalidateIfStale: a,
                        refreshInterval: u,
                        refreshWhenHidden: c,
                        refreshWhenOffline: d,
                        keepPreviousData: p
                    } = r, [h, m, k, b] = v.get(n), [C, j] = G(e), O = (0, f.useRef)(!1), E = (0, f.useRef)(!1), U = (0, f.useRef)(C), M = (0, f.useRef)(t), z = (0, f.useRef)(r), L = () => z.current, A = () => L().isVisible() && L().isOnline(), [T, R, F, B] = I(n, C), $ = (0, f.useRef)({}).current, K = _(s) ? _(r.fallback) ? y : r.fallback[C] : s, J = (e, t) => {
                        for (let r in $)
                            if ("data" === r) {
                                if (!i(e[r], t[r]) && (!_(e[r]) || !i(en, t[r]))) return !1
                            } else if (t[r] !== e[r]) return !1;
                        return !0
                    }, q = (0, f.useMemo)(() => {
                        let e = !!C && !!t && (_(l) ? !L().isPaused() && !o && !1 !== a : l),
                            r = t => {
                                let r = P(t);
                                return (delete r._k, e) ? {
                                    isValidating: !0,
                                    isLoading: !0,
                                    ...r
                                } : r
                            },
                            n = T(),
                            i = B(),
                            s = r(n),
                            u = n === i ? s : r(i),
                            c = s;
                        return [() => {
                            let e = r(T());
                            return J(e, c) ? (c.data = e.data, c.isLoading = e.isLoading, c.isValidating = e.isValidating, c.error = e.error, c) : (c = e, e)
                        }, () => u]
                    }, [n, C]), V = (0, g.useSyncExternalStore)((0, f.useCallback)(e => F(C, (t, r) => {
                        J(r, t) || e()
                    }), [n, C]), q[0], q[1]), Y = !O.current, Q = h[C] && h[C].length > 0, X = V.data, ee = _(X) ? K && w(K) ? ej(K) : K : X, et = V.error, er = (0, f.useRef)(ee), en = p ? _(X) ? _(er.current) ? ee : er.current : X : ee, ei = (!Q || !!_(et)) && (Y && !_(l) ? l : !L().isPaused() && (o ? !_(ee) && a : _(ee) || a)), eo = !!(C && t && Y && ei), es = _(V.isValidating) ? eo : V.isValidating, el = _(V.isLoading) ? eo : V.isLoading, ea = (0, f.useCallback)(async e => {
                        let t, n;
                        let o = M.current;
                        if (!C || !o || E.current || L().isPaused()) return !1;
                        let s = !0,
                            l = e || {},
                            a = !k[C] || !l.dedupe,
                            u = () => W ? !E.current && C === U.current && O.current : C === U.current,
                            c = {
                                isValidating: !1,
                                isLoading: !1
                            },
                            d = () => {
                                R(c)
                            },
                            p = () => {
                                let e = k[C];
                                e && e[1] === n && delete k[C]
                            },
                            f = {
                                isValidating: !0
                            };
                        _(T().data) && (f.isLoading = !0);
                        try {
                            if (a && (R(f), r.loadingTimeout && _(T().data) && setTimeout(() => {
                                    s && u() && L().onLoadingSlow(C, r)
                                }, r.loadingTimeout), k[C] = [o(j), H()]), [t, n] = k[C], t = await t, a && setTimeout(p, r.dedupingInterval), !k[C] || k[C][1] !== n) return a && u() && L().onDiscarded(C), !1;
                            c.error = y;
                            let e = m[C];
                            if (!_(e) && (n <= e[0] || n <= e[1] || 0 === e[1])) return d(), a && u() && L().onDiscarded(C), !1;
                            let l = T().data;
                            c.data = i(l, t) ? l : t, a && u() && L().onSuccess(t, C, r)
                        } catch (r) {
                            p();
                            let e = L(),
                                {
                                    shouldRetryOnError: t
                                } = e;
                            !e.isPaused() && (c.error = r, a && u() && (e.onError(r, C, e), (!0 === t || S(t) && t(r)) && (!L().revalidateOnFocus || !L().revalidateOnReconnect || A()) && e.onErrorRetry(r, C, e, e => {
                                let t = h[C];
                                t && t[0] && t[0](3, e)
                            }, {
                                retryCount: (l.retryCount || 0) + 1,
                                dedupe: !0
                            })))
                        }
                        return s = !1, d(), !0
                    }, [C, n]), eu = (0, f.useCallback)((...e) => Z(n, U.current, ...e), []);
                    if (N(() => {
                            M.current = t, z.current = r, _(X) || (er.current = X)
                        }), N(() => {
                            if (!C) return;
                            let e = ea.bind(y, eO),
                                t = 0;
                            L().revalidateOnFocus && (t = Date.now() + L().focusThrottleInterval);
                            let r = ep(C, h, (r, n = {}) => {
                                if (0 == r) {
                                    let r = Date.now();
                                    L().revalidateOnFocus && r > t && A() && (t = r + L().focusThrottleInterval, e())
                                } else if (1 == r) L().revalidateOnReconnect && A() && e();
                                else if (2 == r) return ea();
                                else if (3 == r) return ea(n)
                            });
                            return E.current = !1, U.current = C, O.current = !0, R({
                                _k: j
                            }), ei && !k[C] && (_(ee) || x ? e() : D(e)), () => {
                                E.current = !0, r()
                            }
                        }, [C]), N(() => {
                            let e;

                            function t() {
                                let t = S(u) ? u(T().data) : u;
                                t && -1 !== e && (e = setTimeout(r, t))
                            }

                            function r() {
                                !T().error && (c || L().isVisible()) && (d || L().isOnline()) ? ea(eO).then(t) : t()
                            }
                            return t(), () => {
                                e && (clearTimeout(e), e = -1)
                            }
                        }, [u, c, d, C]), (0, f.useDebugValue)(en), o && _(ee) && C) {
                        if (!W && x) throw Error("Fallback data is required when using Suspense in SSR.");
                        M.current = t, z.current = r, E.current = !1;
                        let e = b[C];
                        if (_(e) || ej(eu(e)), _(et)) {
                            let e = ea(eO);
                            _(en) || (e.status = "fulfilled", e.value = !0), ej(e)
                        } else throw et
                    }
                    return {
                        mutate: eu,
                        get data() {
                            return $.data = !0, en
                        },
                        get error() {
                            return $.error = !0, et
                        },
                        get isValidating() {
                            return $.isValidating = !0, es
                        },
                        get isLoading() {
                            return $.isLoading = !0, el
                        }
                    }
                }, function(...e) {
                    let t = eu(),
                        [r, i, o] = ea(e),
                        s = en(t, o),
                        l = n,
                        {
                            use: a
                        } = s,
                        u = (a || []).concat(ed);
                    for (let e = u.length; e--;) l = u[e](l);
                    return l(r, i || s.fetcher || null, s)
                }),
                eM = () => {},
                ez = eM(),
                eI = Object,
                eL = e => e === ez,
                eA = e => "function" == typeof e,
                eT = new WeakMap,
                eR = e => eI.prototype.toString.call(e),
                eW = (e, t) => e === `[object ${t}]`,
                ex = 0,
                eD = e => {
                    let t, r;
                    let n = typeof e,
                        i = eR(e),
                        o = eW(i, "Date"),
                        s = eW(i, "RegExp"),
                        l = eW(i, "Object");
                    if (eI(e) !== e || o || s) t = o ? e.toJSON() : "symbol" == n ? e.toString() : "string" == n ? JSON.stringify(e) : "" + e;
                    else {
                        if (t = eT.get(e)) return t;
                        if (t = ++ex + "~", eT.set(e, t), Array.isArray(e)) {
                            for (r = 0, t = "@"; r < e.length; r++) t += eD(e[r]) + ",";
                            eT.set(e, t)
                        }
                        if (l) {
                            t = "#";
                            let n = eI.keys(e).sort();
                            for (; !eL(r = n.pop());) eL(e[r]) || (t += r + ":" + eD(e[r]) + ",");
                            eT.set(e, t)
                        }
                    }
                    return t
                },
                eN = e => {
                    if (eA(e)) try {
                        e = e()
                    } catch (t) {
                        e = ""
                    }
                    let t = e;
                    return [e = "string" == typeof e ? e : (Array.isArray(e) ? e.length : e) ? eD(e) : "", t]
                },
                eF = e => eN(e ? e(0, null) : null)[0],
                eB = Promise.resolve(),
                e$ = eh(eU, e => (t, r, n) => {
                    let i;
                    let o = (0, f.useRef)(!1),
                        {
                            cache: s,
                            initialSize: l = 1,
                            revalidateAll: a = !1,
                            persistSize: u = !1,
                            revalidateFirstPage: c = !0,
                            revalidateOnMount: d = !1,
                            parallel: p = !1
                        } = n,
                        [, , , h] = v.get(ee);
                    try {
                        (i = eF(t)) && (i = eo + i)
                    } catch (e) {}
                    let [m, k, b] = I(s, i), P = (0, f.useCallback)(() => _(m()._l) ? l : m()._l, [s, i, l]);
                    (0, g.useSyncExternalStore)((0, f.useCallback)(e => i ? b(i, () => {
                        e()
                    }) : () => {}, [s, i]), P, P);
                    let w = (0, f.useCallback)(() => {
                            let e = m()._l;
                            return _(e) ? l : e
                        }, [i, l]),
                        C = (0, f.useRef)(w());
                    N(() => {
                        if (!o.current) {
                            o.current = !0;
                            return
                        }
                        i && k({
                            _l: u ? C.current : w()
                        })
                    }, [i, s]);
                    let j = d && !o.current,
                        O = e(i, async e => {
                            let i = m()._i,
                                o = m()._r;
                            k({
                                _r: y
                            });
                            let l = [],
                                u = w(),
                                [d] = I(s, e),
                                f = d().data,
                                g = [],
                                v = null;
                            for (let e = 0; e < u; ++e) {
                                let [u, d] = G(t(e, p ? null : v));
                                if (!u) break;
                                let [m, k] = I(s, u), y = m().data, b = a || i || _(y) || c && !e && !_(f) || j || f && !_(f[e]) && !n.compare(f[e], y);
                                if (r && ("function" == typeof o ? o(y, d) : b)) {
                                    let t = async () => {
                                        if (u in h) {
                                            let e = h[u];
                                            delete h[u], y = await e
                                        } else y = await r(d);
                                        k({
                                            data: y,
                                            _k: d
                                        }), l[e] = y
                                    };
                                    p ? g.push(t) : await t()
                                } else l[e] = y;
                                p || (v = y)
                            }
                            return p && await Promise.all(g.map(e => e())), k({
                                _i: y
                            }), l
                        }, n),
                        E = (0, f.useCallback)(function(e, t) {
                            let r = "boolean" == typeof t ? {
                                    revalidate: t
                                } : t || {},
                                n = !1 !== r.revalidate;
                            return i ? (n && (_(e) ? k({
                                _i: !0,
                                _r: r.revalidate
                            }) : k({
                                _i: !1,
                                _r: r.revalidate
                            })), arguments.length ? O.mutate(e, { ...r,
                                revalidate: n
                            }) : O.mutate()) : eB
                        }, [i, s]),
                        U = (0, f.useCallback)(e => {
                            let r;
                            if (!i) return eB;
                            let [, n] = I(s, i);
                            if (S(e) ? r = e(w()) : "number" == typeof e && (r = e), "number" != typeof r) return eB;
                            n({
                                _l: r
                            }), C.current = r;
                            let o = [],
                                [l] = I(s, i),
                                a = null;
                            for (let e = 0; e < r; ++e) {
                                let [r] = G(t(e, a)), [n] = I(s, r), i = r ? n().data : y;
                                if (_(i)) return E(l().data);
                                o.push(i), a = i
                            }
                            return E(o)
                        }, [i, s, E, w]);
                    return {
                        size: w(),
                        setSize: U,
                        mutate: E,
                        get data() {
                            return O.data
                        },
                        get error() {
                            return O.error
                        },
                        get isValidating() {
                            return O.isValidating
                        },
                        get isLoading() {
                            return O.isLoading
                        }
                    }
                });
            var eK = Object.prototype.hasOwnProperty;

            function eJ(e, t, r) {
                for (r of e.keys())
                    if (eq(r, t)) return r
            }

            function eq(e, t) {
                var r, n, i;
                if (e === t) return !0;
                if (e && t && (r = e.constructor) === t.constructor) {
                    if (r === Date) return e.getTime() === t.getTime();
                    if (r === RegExp) return e.toString() === t.toString();
                    if (r === Array) {
                        if ((n = e.length) === t.length)
                            for (; n-- && eq(e[n], t[n]););
                        return -1 === n
                    }
                    if (r === Set) {
                        if (e.size !== t.size) return !1;
                        for (n of e)
                            if ((i = n) && "object" == typeof i && !(i = eJ(t, i)) || !t.has(i)) return !1;
                        return !0
                    }
                    if (r === Map) {
                        if (e.size !== t.size) return !1;
                        for (n of e)
                            if ((i = n[0]) && "object" == typeof i && !(i = eJ(t, i)) || !eq(n[1], t.get(i))) return !1;
                        return !0
                    }
                    if (r === ArrayBuffer) e = new Uint8Array(e), t = new Uint8Array(t);
                    else if (r === DataView) {
                        if ((n = e.byteLength) === t.byteLength)
                            for (; n-- && e.getInt8(n) === t.getInt8(n););
                        return -1 === n
                    }
                    if (ArrayBuffer.isView(e)) {
                        if ((n = e.byteLength) === t.byteLength)
                            for (; n-- && e[n] === t[n];);
                        return -1 === n
                    }
                    if (!r || "object" == typeof e) {
                        for (r in n = 0, e)
                            if (eK.call(e, r) && ++n && !eK.call(t, r) || !(r in t) || !eq(e[r], t[r])) return !1;
                        return Object.keys(t).length === n
                    }
                }
                return e != e && t != t
            }
            let eV = W ? e => {
                    e()
                } : f.startTransition,
                eG = e => {
                    let [, t] = (0, f.useState)({}), r = (0, f.useRef)(!1), n = (0, f.useRef)(e), i = (0, f.useRef)({
                        data: !1,
                        error: !1,
                        isValidating: !1
                    }), o = (0, f.useCallback)(e => {
                        let o = !1,
                            s = n.current;
                        for (let t in e) Object.prototype.hasOwnProperty.call(e, t) && s[t] !== e[t] && (s[t] = e[t], i.current[t] && (o = !0));
                        o && !r.current && t({})
                    }, []);
                    return N(() => (r.current = !1, () => {
                        r.current = !0
                    })), [n, i.current, o]
                },
                eY = eh(eU, () => (e, t, r = {}) => {
                    let {
                        mutate: n
                    } = eu(), i = (0, f.useRef)(e), o = (0, f.useRef)(t), s = (0, f.useRef)(r), l = (0, f.useRef)(0), [a, u, c] = eG({
                        data: y,
                        error: y,
                        isMutating: !1
                    }), d = a.current, p = (0, f.useCallback)(async (e, t) => {
                        let [r, a] = G(i.current);
                        if (!o.current) throw Error("Can’t trigger the mutation: missing fetcher.");
                        if (!r) throw Error("Can’t trigger the mutation: missing key.");
                        let u = P(P({
                                populateCache: !1,
                                throwOnError: !0
                            }, s.current), t),
                            d = H();
                        l.current = d, c({
                            isMutating: !0
                        });
                        try {
                            let t = await n(r, o.current(a, {
                                arg: e
                            }), P(u, {
                                throwOnError: !0
                            }));
                            return l.current <= d && (eV(() => c({
                                data: t,
                                isMutating: !1,
                                error: void 0
                            })), null == u.onSuccess || u.onSuccess.call(u, t, r, u)), t
                        } catch (e) {
                            if (l.current <= d && (eV(() => c({
                                    error: e,
                                    isMutating: !1
                                })), null == u.onError || u.onError.call(u, e, r, u), u.throwOnError)) throw e
                        }
                    }, []), h = (0, f.useCallback)(() => {
                        l.current = H(), c({
                            data: y,
                            error: y,
                            isMutating: !1
                        })
                    }, []);
                    return N(() => {
                        i.current = e, o.current = t, s.current = r
                    }), {
                        trigger: p,
                        reset: h,
                        get data() {
                            return u.data = !0, d.data
                        },
                        get error() {
                            return u.error = !0, d.error
                        },
                        get isMutating() {
                            return u.isMutating = !0, d.isMutating
                        }
                    }
                });

            function eH(e, t) {
                if (!e) throw "string" == typeof t ? Error(t) : Error(`${t.displayName} not found`)
            }
            var eZ = (e, t) => {
                    let {
                        assertCtxFn: r = eH
                    } = t || {}, n = f.createContext(void 0);
                    return n.displayName = e, [n, () => {
                        let t = f.useContext(n);
                        return r(t, `${e} not found`), t.value
                    }, () => {
                        let e = f.useContext(n);
                        return e ? e.value : {}
                    }]
                },
                eQ = {};
            (0, h.r2)(eQ, {
                useSWR: () => eU,
                useSWRInfinite: () => e$
            }), (0, h.yA)(eQ, i);
            var [eX, e0] = eZ("ClerkInstanceContext"), [e1, e2] = eZ("UserContext"), [e5, e6] = eZ("ClientContext"), [e3, e7] = eZ("SessionContext");
            f.createContext({});
            var [e4, e8] = eZ("CheckoutContext"), e9 = ({
                children: e,
                ...t
            }) => f.createElement(e4.Provider, {
                value: {
                    value: t
                }
            }, e), [te, tt] = eZ("OrganizationContext"), tr = ({
                children: e,
                organization: t,
                swrConfig: r
            }) => f.createElement(eQ.SWRConfig, {
                value: r
            }, f.createElement(te.Provider, {
                value: {
                    value: {
                        organization: t
                    }
                }
            }, e));

            function tn(e) {
                if (!f.useContext(eX)) {
                    if ("function" == typeof e) {
                        e();
                        return
                    }
                    throw Error(`${e} can only be used within the <ClerkProvider /> component.

Possible fixes:
1. Ensure that the <ClerkProvider /> is correctly wrapping your application where this component is used.
2. Check for multiple versions of the \`@clerk/shared\` package in your project. Use a tool like \`npm ls @clerk/shared\` to identify multiple versions, and update your dependencies to only rely on one.

Learn more: https://clerk.com/docs/components/clerk-provider`.trim())
                }
            }

            function ti(e, t) {
                let r = new Set(Object.keys(t)),
                    n = {};
                for (let t of Object.keys(e)) r.has(t) || (n[t] = e[t]);
                return n
            }
            var to = (e, t) => {
                    let r = "boolean" == typeof e && e,
                        n = (0, f.useRef)(r ? t.initialPage : e ? .initialPage ? ? t.initialPage),
                        i = (0, f.useRef)(r ? t.pageSize : e ? .pageSize ? ? t.pageSize),
                        o = {};
                    for (let n of Object.keys(t)) o[n] = r ? t[n] : e ? .[n] ? ? t[n];
                    return { ...o,
                        initialPage: n.current,
                        pageSize: i.current
                    }
                },
                ts = {
                    dedupingInterval: 6e4,
                    focusThrottleInterval: 12e4
                },
                tl = (e, t, r, n) => {
                    let [i, o] = (0, f.useState)(e.initialPage ? ? 1), s = (0, f.useRef)(e.initialPage ? ? 1), l = (0, f.useRef)(e.pageSize ? ? 10), a = r.enabled ? ? !0, u = "cache" === r.__experimental_mode, c = r.infinite ? ? !1, d = r.keepPreviousData ? ? !1, p = { ...n,
                        ...e,
                        initialPage: i,
                        pageSize: l.current
                    }, {
                        data: h,
                        isValidating: g,
                        isLoading: m,
                        error: v,
                        mutate: k
                    } = eU(!c && a && (u || t) ? p : null, !u && t ? r => {
                        let i = ti(r, n);
                        return t({ ...e,
                            ...i
                        })
                    } : null, {
                        keepPreviousData: d,
                        ...ts
                    }), {
                        data: y,
                        isLoading: b,
                        isValidating: _,
                        error: S,
                        size: P,
                        setSize: w,
                        mutate: C
                    } = e$(t => c && a ? { ...e,
                        ...n,
                        initialPage: s.current + t,
                        pageSize: l.current
                    } : null, e => {
                        let r = ti(e, n);
                        return t ? .(r)
                    }, ts), j = (0, f.useMemo)(() => c ? P : i, [c, P, i]), O = (0, f.useCallback)(e => {
                        if (c) {
                            w(e);
                            return
                        }
                        return o(e)
                    }, [w]), E = (0, f.useMemo)(() => c ? y ? .map(e => e ? .data).flat() ? ? [] : h ? .data ? ? [], [c, h, y]), U = (0, f.useMemo)(() => c ? y ? .[y ? .length - 1] ? .total_count || 0 : h ? .total_count ? ? 0, [c, h, y]), M = c ? b : m, z = c ? _ : g, I = (c ? S : v) ? ? null, L = (0, f.useCallback)(() => {
                        O(e => Math.max(0, e + 1))
                    }, [O]), A = (0, f.useCallback)(() => {
                        O(e => Math.max(0, e - 1))
                    }, [O]), T = (s.current - 1) * l.current, R = Math.ceil((U - T) / l.current), W = U - T * l.current > j * l.current, x = (j - 1) * l.current > T * l.current, D = c ? e => C(e, {
                        revalidate: !1
                    }) : e => k(e, {
                        revalidate: !1
                    });
                    return {
                        data: E,
                        count: U,
                        error: I,
                        isLoading: M,
                        isFetching: z,
                        isError: !!I,
                        page: j,
                        pageCount: R,
                        fetchPage: O,
                        fetchNext: L,
                        fetchPrevious: A,
                        hasNextPage: W,
                        hasPreviousPage: x,
                        revalidate: c ? () => C() : () => k(),
                        setData: D
                    }
                },
                ta = {
                    data: void 0,
                    count: void 0,
                    error: void 0,
                    isLoading: !1,
                    isFetching: !1,
                    isError: !1,
                    page: void 0,
                    pageCount: void 0,
                    fetchPage: void 0,
                    fetchNext: void 0,
                    fetchPrevious: void 0,
                    hasNextPage: !1,
                    hasPreviousPage: !1,
                    revalidate: void 0,
                    setData: void 0
                };

            function tu(e) {
                var t, r;
                let {
                    domains: n,
                    membershipRequests: i,
                    memberships: s,
                    invitations: l,
                    subscriptions: a
                } = e || {};
                tn("useOrganization");
                let {
                    organization: u
                } = tt(), c = e7(), d = to(n, {
                    initialPage: 1,
                    pageSize: 10,
                    keepPreviousData: !1,
                    infinite: !1,
                    enrollmentMode: void 0
                }), p = to(i, {
                    initialPage: 1,
                    pageSize: 10,
                    status: "pending",
                    keepPreviousData: !1,
                    infinite: !1
                }), h = to(s, {
                    initialPage: 1,
                    pageSize: 10,
                    role: void 0,
                    keepPreviousData: !1,
                    infinite: !1,
                    query: void 0
                }), f = to(l, {
                    initialPage: 1,
                    pageSize: 10,
                    status: ["pending"],
                    keepPreviousData: !1,
                    infinite: !1
                }), g = to(a, {
                    initialPage: 1,
                    pageSize: 10,
                    keepPreviousData: !1,
                    infinite: !1
                }), m = e0();
                m.telemetry ? .record(o.J6("useOrganization"));
                let v = void 0 === n ? void 0 : {
                        initialPage: d.initialPage,
                        pageSize: d.pageSize,
                        enrollmentMode: d.enrollmentMode
                    },
                    k = void 0 === i ? void 0 : {
                        initialPage: p.initialPage,
                        pageSize: p.pageSize,
                        status: p.status
                    },
                    y = void 0 === s ? void 0 : {
                        initialPage: h.initialPage,
                        pageSize: h.pageSize,
                        role: h.role,
                        query: h.query
                    },
                    b = void 0 === l ? void 0 : {
                        initialPage: f.initialPage,
                        pageSize: f.pageSize,
                        status: f.status
                    },
                    _ = void 0 === a ? void 0 : {
                        initialPage: g.initialPage,
                        pageSize: g.pageSize,
                        orgId: u ? .id
                    },
                    S = tl({ ...v
                    }, u ? .getDomains, {
                        keepPreviousData: d.keepPreviousData,
                        infinite: d.infinite,
                        enabled: !!v
                    }, {
                        type: "domains",
                        organizationId: u ? .id
                    }),
                    P = tl({ ...k
                    }, u ? .getMembershipRequests, {
                        keepPreviousData: p.keepPreviousData,
                        infinite: p.infinite,
                        enabled: !!k
                    }, {
                        type: "membershipRequests",
                        organizationId: u ? .id
                    }),
                    w = tl(y || {}, u ? .getMemberships, {
                        keepPreviousData: h.keepPreviousData,
                        infinite: h.infinite,
                        enabled: !!y
                    }, {
                        type: "members",
                        organizationId: u ? .id
                    }),
                    C = tl({ ...b
                    }, u ? .getInvitations, {
                        keepPreviousData: f.keepPreviousData,
                        infinite: f.infinite,
                        enabled: !!b
                    }, {
                        type: "invitations",
                        organizationId: u ? .id
                    }),
                    j = tl({ ..._
                    }, u ? .getSubscriptions, {
                        keepPreviousData: g.keepPreviousData,
                        infinite: g.infinite,
                        enabled: !!_
                    }, {
                        type: "subscriptions",
                        organizationId: u ? .id
                    });
                return void 0 === u ? {
                    isLoaded: !1,
                    organization: void 0,
                    membership: void 0,
                    domains: ta,
                    membershipRequests: ta,
                    memberships: ta,
                    invitations: ta,
                    subscriptions: ta
                } : null === u ? {
                    isLoaded: !0,
                    organization: null,
                    membership: null,
                    domains: null,
                    membershipRequests: null,
                    memberships: null,
                    invitations: null,
                    subscriptions: null
                } : !m.loaded && u ? {
                    isLoaded: !0,
                    organization: u,
                    membership: void 0,
                    domains: ta,
                    membershipRequests: ta,
                    memberships: ta,
                    invitations: ta,
                    subscriptions: ta
                } : {
                    isLoaded: m.loaded,
                    organization: u,
                    membership: (t = c.user.organizationMemberships, r = u.id, t.find(e => e.organization.id === r)),
                    domains: S,
                    membershipRequests: P,
                    memberships: w,
                    invitations: C,
                    subscriptions: j
                }
            }
            var tc = {
                data: void 0,
                count: void 0,
                error: void 0,
                isLoading: !1,
                isFetching: !1,
                isError: !1,
                page: void 0,
                pageCount: void 0,
                fetchPage: void 0,
                fetchNext: void 0,
                fetchPrevious: void 0,
                hasNextPage: !1,
                hasPreviousPage: !1,
                revalidate: void 0,
                setData: void 0
            };

            function td(e) {
                let {
                    userMemberships: t,
                    userInvitations: r,
                    userSuggestions: n
                } = e || {};
                tn("useOrganizationList");
                let i = to(t, {
                        initialPage: 1,
                        pageSize: 10,
                        keepPreviousData: !1,
                        infinite: !1
                    }),
                    s = to(r, {
                        initialPage: 1,
                        pageSize: 10,
                        status: "pending",
                        keepPreviousData: !1,
                        infinite: !1
                    }),
                    l = to(n, {
                        initialPage: 1,
                        pageSize: 10,
                        status: "pending",
                        keepPreviousData: !1,
                        infinite: !1
                    }),
                    a = e0(),
                    u = e2();
                a.telemetry ? .record(o.J6("useOrganizationList"));
                let c = void 0 === t ? void 0 : {
                        initialPage: i.initialPage,
                        pageSize: i.pageSize
                    },
                    d = void 0 === r ? void 0 : {
                        initialPage: s.initialPage,
                        pageSize: s.pageSize,
                        status: s.status
                    },
                    p = void 0 === n ? void 0 : {
                        initialPage: l.initialPage,
                        pageSize: l.pageSize,
                        status: l.status
                    },
                    h = !!(a.loaded && u),
                    f = tl(c || {}, u ? .getOrganizationMemberships, {
                        keepPreviousData: i.keepPreviousData,
                        infinite: i.infinite,
                        enabled: !!c
                    }, {
                        type: "userMemberships",
                        userId: u ? .id
                    }),
                    g = tl({ ...d
                    }, u ? .getOrganizationInvitations, {
                        keepPreviousData: s.keepPreviousData,
                        infinite: s.infinite,
                        enabled: !!d
                    }, {
                        type: "userInvitations",
                        userId: u ? .id
                    }),
                    m = tl({ ...p
                    }, u ? .getOrganizationSuggestions, {
                        keepPreviousData: l.keepPreviousData,
                        infinite: l.infinite,
                        enabled: !!p
                    }, {
                        type: "userSuggestions",
                        userId: u ? .id
                    });
                return h ? {
                    isLoaded: h,
                    setActive: a.setActive,
                    createOrganization: a.createOrganization,
                    userMemberships: f,
                    userInvitations: g,
                    userSuggestions: m
                } : {
                    isLoaded: !1,
                    createOrganization: void 0,
                    setActive: void 0,
                    userMemberships: tc,
                    userInvitations: tc,
                    userSuggestions: tc
                }
            }
            var tp = "undefined" != typeof window ? f.useLayoutEffect : f.useEffect,
                th = "useSession",
                tf = (e = {}) => {
                    tn(th);
                    let t = e7(),
                        r = e0();
                    if (r.telemetry ? .record(o.J6(th)), void 0 === t) return {
                        isLoaded: !1,
                        isSignedIn: void 0,
                        session: void 0
                    };
                    let n = t ? .status === "pending" && (e.treatPendingAsSignedOut ? ? r.__internal_getOption("treatPendingAsSignedOut"));
                    return null === t || n ? {
                        isLoaded: !0,
                        isSignedIn: !1,
                        session: null
                    } : {
                        isLoaded: !0,
                        isSignedIn: !0,
                        session: t
                    }
                },
                tg = "useSessionList",
                tm = () => {
                    tn(tg);
                    let e = e0(),
                        t = e6(),
                        r = e0();
                    return (r.telemetry ? .record(o.J6(tg)), t) ? {
                        isLoaded: !0,
                        sessions: t.sessions,
                        setActive: e.setActive
                    } : {
                        isLoaded: !1,
                        sessions: void 0,
                        setActive: void 0
                    }
                },
                tv = "useUser";

            function tk() {
                tn(tv);
                let e = e2(),
                    t = e0();
                return (t.telemetry ? .record(o.J6(tv)), void 0 === e) ? {
                    isLoaded: !1,
                    isSignedIn: void 0,
                    user: void 0
                } : null === e ? {
                    isLoaded: !0,
                    isSignedIn: !1,
                    user: null
                } : {
                    isLoaded: !0,
                    isSignedIn: !0,
                    user: e
                }
            }
            var ty = () => (tn("useClerk"), e0()),
                tb = eq;
            async function t_(e) {
                try {
                    let t = await e;
                    if (t instanceof Response) return t.json();
                    return t
                } catch (e) {
                    if ((0, a.kD)(e) && e.errors.find(({
                            code: e
                        }) => "session_reverification_required" === e)) return c();
                    throw e
                }
            }
            var tS = (e, t) => {
                let {
                    __internal_openReverification: r,
                    telemetry: n
                } = ty(), i = (0, f.useRef)(e), s = (0, f.useRef)(t);
                return n ? .record(o.J6("useReverification", {
                    onNeedsReverification: !!t ? .onNeedsReverification
                })), tp(() => {
                    i.current = e, s.current = t
                }), (0, f.useCallback)((...e) => {
                    var t;
                    return (t = {
                        openUIComponent: r,
                        telemetry: n,
                        ...s.current
                    }, function(e) {
                        return async (...r) => {
                            let n = await t_(e(...r));
                            if (d(n)) {
                                let i = l(),
                                    o = (0, p.Pm)(n.clerk_error.metadata ? .reverification),
                                    s = o ? o().level : void 0,
                                    u = () => {
                                        i.reject(new a.w$("User cancelled attempted verification", {
                                            code: "reverification_cancelled"
                                        }))
                                    },
                                    c = () => {
                                        i.resolve(!0)
                                    };
                                void 0 === t.onNeedsReverification ? t.openUIComponent ? .({
                                    level: s,
                                    afterVerification: c,
                                    afterVerificationCancelled: u
                                }) : t.onNeedsReverification({
                                    cancel: u,
                                    complete: c,
                                    level: s
                                }), await i.promise, n = await t_(e(...r))
                            }
                            return n
                        }
                    })(i.current)(...e)
                }, [r, n])
            };

            function tP({
                hookName: e,
                resourceType: t,
                useFetcher: r,
                options: n
            }) {
                return function(i) {
                    let {
                        for: s,
                        ...l
                    } = i;
                    tn(e);
                    let a = r(s),
                        u = to(l, {
                            initialPage: 1,
                            pageSize: 10,
                            keepPreviousData: !1,
                            infinite: !1,
                            __experimental_mode: void 0
                        }),
                        c = e0(),
                        d = e2(),
                        {
                            organization: p
                        } = tt();
                    c.telemetry ? .record(o.J6(e));
                    let h = void 0 === l ? void 0 : {
                            initialPage: u.initialPage,
                            pageSize: u.pageSize,
                            ..."organization" === s ? {
                                orgId: p ? .id
                            } : {}
                        },
                        f = !!(c.loaded && (n ? .unauthenticated || d));
                    return tl(h || {}, a, {
                        keepPreviousData: u.keepPreviousData,
                        infinite: u.infinite,
                        enabled: !!h && f,
                        __experimental_mode: u.__experimental_mode
                    }, {
                        type: t,
                        userId: d ? .id,
                        ..."organization" === s ? {
                            orgId: p ? .id
                        } : {}
                    })
                }
            }
            tP({
                hookName: "useStatements",
                resourceType: "commerce-statements",
                useFetcher: () => e0().billing.getStatements
            }), tP({
                hookName: "usePaymentAttempts",
                resourceType: "commerce-payment-attempts",
                useFetcher: () => e0().billing.getPaymentAttempts
            }), tP({
                hookName: "usePaymentMethods",
                resourceType: "commerce-payment-methods",
                useFetcher: e => {
                    let {
                        organization: t
                    } = tt(), r = e2();
                    return "organization" === e ? t ? .getPaymentSources : r ? .getPaymentSources
                }
            }), tP({
                hookName: "useSubscriptionItems",
                resourceType: "commerce-subscription-items",
                useFetcher: () => e0().billing.getSubscriptions
            }), tP({
                hookName: "usePlans",
                resourceType: "commerce-plans",
                useFetcher: e => {
                    let t = e0();
                    return r => t.billing.getPlans({ ...r,
                        for: "organization" === e ? "org" : "user"
                    })
                },
                options: {
                    unauthenticated: !0
                }
            });
            var tw = e => {
                    let t = e8(),
                        {
                            for: r,
                            planId: n,
                            planPeriod: i
                        } = e || t,
                        o = ty(),
                        {
                            organization: s
                        } = tu(),
                        {
                            user: l
                        } = tk();
                    if (!l) throw Error("Clerk: User is not authenticated");
                    if ("organization" === r && !s) throw Error("Clerk: Use `setActive` to set the organization");
                    let a = (0, f.useMemo)(() => o.__experimental_checkout({
                            planId: n,
                            planPeriod: i,
                            for: r
                        }), [l.id, s ? .id, n, i, r]),
                        u = (0, f.useSyncExternalStore)(e => a.subscribe(e), () => a.getState(), () => a.getState());
                    return {
                        checkout: { ...(0, f.useMemo)(() => {
                                if (!u.checkout) return {
                                    id: null,
                                    externalClientSecret: null,
                                    externalGatewayId: null,
                                    statement_id: null,
                                    status: null,
                                    totals: null,
                                    isImmediatePlanChange: null,
                                    planPeriod: null,
                                    plan: null,
                                    paymentSource: null
                                };
                                let {
                                    reload: e,
                                    confirm: t,
                                    pathRoot: r,
                                    ...n
                                } = u.checkout;
                                return n
                            }, [u.checkout]),
                            getState: a.getState,
                            start: a.start,
                            confirm: a.confirm,
                            clear: a.clear,
                            finalize: a.finalize,
                            isStarting: u.isStarting,
                            isConfirming: u.isConfirming,
                            error: u.error,
                            status: u.status,
                            fetchStatus: u.fetchStatus
                        }
                    }
                },
                tC = e => {
                    let t = (0, f.useRef)(e);
                    return (0, f.useEffect)(() => {
                        t.current = e
                    }, [e]), t.current
                },
                tj = (e, t, r) => {
                    let n = !!r,
                        i = (0, f.useRef)(r);
                    (0, f.useEffect)(() => {
                        i.current = r
                    }, [r]), (0, f.useEffect)(() => {
                        if (!n || !e) return () => {};
                        let r = (...e) => {
                            i.current && i.current(...e)
                        };
                        return e.on(t, r), () => {
                            e.off(t, r)
                        }
                    }, [n, t, e, i])
                },
                tO = f.createContext(null);
            tO.displayName = "ElementsContext";
            var tE = (e, t) => {
                    if (!e) throw Error(`Could not find Elements context; You need to wrap the part of your app that ${t} in an <Elements> provider.`);
                    return e
                },
                tU = ({
                    stripe: e,
                    options: t,
                    children: r
                }) => {
                    let n = f.useMemo(() => tA(e), [e]),
                        [i, o] = f.useState(() => ({
                            stripe: "sync" === n.tag ? n.stripe : null,
                            elements: "sync" === n.tag ? n.stripe.elements(t) : null
                        }));
                    f.useEffect(() => {
                        let e = !0,
                            r = e => {
                                o(r => r.stripe ? r : {
                                    stripe: e,
                                    elements: e.elements(t)
                                })
                            };
                        return "async" !== n.tag || i.stripe ? "sync" !== n.tag || i.stripe || r(n.stripe) : n.stripePromise.then(t => {
                            t && e && r(t)
                        }), () => {
                            e = !1
                        }
                    }, [n, i, t]);
                    let s = tC(e);
                    f.useEffect(() => {
                        null !== s && s !== e && console.warn("Unsupported prop change on Elements: You cannot change the `stripe` prop after setting it.")
                    }, [s, e]);
                    let l = tC(t);
                    return f.useEffect(() => {
                        if (!i.elements) return;
                        let e = tx(t, l, ["clientSecret", "fonts"]);
                        e && i.elements.update(e)
                    }, [t, l, i.elements]), f.createElement(tO.Provider, {
                        value: i
                    }, r)
                },
                tM = e => tE(f.useContext(tO), e),
                tz = () => {
                    let {
                        elements: e
                    } = tM("calls useElements()");
                    return e
                },
                tI = "Invalid prop `stripe` supplied to `Elements`. We recommend using the `loadStripe` utility from `@stripe/stripe-js`. See https://stripe.com/docs/stripe-js/react#elements-props-stripe for details.",
                tL = (e, t = tI) => {
                    if (null === e || tW(e)) return e;
                    throw Error(t)
                },
                tA = (e, t = tI) => {
                    if (tR(e)) return {
                        tag: "async",
                        stripePromise: Promise.resolve(e).then(e => tL(e, t))
                    };
                    let r = tL(e, t);
                    return null === r ? {
                        tag: "empty"
                    } : {
                        tag: "sync",
                        stripe: r
                    }
                },
                tT = e => null !== e && "object" == typeof e,
                tR = e => tT(e) && "function" == typeof e.then,
                tW = e => tT(e) && "function" == typeof e.elements && "function" == typeof e.createToken && "function" == typeof e.createPaymentMethod && "function" == typeof e.confirmCardPayment,
                tx = (e, t, r) => tT(e) ? Object.keys(e).reduce((n, i) => {
                    let o = !tT(t) || !tN(e[i], t[i]);
                    return r.includes(i) ? (o && console.warn(`Unsupported prop change: options.${i} is not a mutable property.`), n) : o ? { ...n || {},
                        [i]: e[i]
                    } : n
                }, null) : null,
                tD = "[object Object]",
                tN = (e, t) => {
                    if (!tT(e) || !tT(t)) return e === t;
                    let r = Array.isArray(e);
                    if (r !== Array.isArray(t)) return !1;
                    let n = Object.prototype.toString.call(e) === tD;
                    if (n !== (Object.prototype.toString.call(t) === tD)) return !1;
                    if (!n && !r) return e === t;
                    let i = Object.keys(e),
                        o = Object.keys(t);
                    if (i.length !== o.length) return !1;
                    let s = {};
                    for (let e = 0; e < i.length; e += 1) s[i[e]] = !0;
                    for (let e = 0; e < o.length; e += 1) s[o[e]] = !0;
                    let l = Object.keys(s);
                    return l.length === i.length && l.every(r => tN(e[r], t[r]))
                },
                tF = () => {
                    let {
                        stripe: e
                    } = tB("calls useStripe()");
                    return e
                },
                tB = e => tE(f.useContext(tO), e),
                t$ = e => e.charAt(0).toUpperCase() + e.slice(1),
                tK = ((e, t) => {
                    let r = `${t$(e)}Element`,
                        n = t ? e => {
                            tB(`mounts <${r}>`);
                            let {
                                id: t,
                                className: n
                            } = e;
                            return f.createElement("div", {
                                id: t,
                                className: n
                            })
                        } : ({
                            id: t,
                            className: n,
                            fallback: i,
                            options: o = {},
                            onBlur: s,
                            onFocus: l,
                            onReady: a,
                            onChange: u,
                            onEscape: c,
                            onClick: d,
                            onLoadError: p,
                            onLoaderStart: h,
                            onNetworksChange: g,
                            onConfirm: m,
                            onCancel: v,
                            onShippingAddressChange: k,
                            onShippingRateChange: y
                        }) => {
                            let b;
                            let _ = tB(`mounts <${r}>`),
                                S = "elements" in _ ? _.elements : null,
                                [P, w] = f.useState(null),
                                C = f.useRef(null),
                                j = f.useRef(null),
                                [O, E] = (0, f.useState)(!1);
                            tj(P, "blur", s), tj(P, "focus", l), tj(P, "escape", c), tj(P, "click", d), tj(P, "loaderror", p), tj(P, "loaderstart", h), tj(P, "networkschange", g), tj(P, "confirm", m), tj(P, "cancel", v), tj(P, "shippingaddresschange", k), tj(P, "shippingratechange", y), tj(P, "change", u), a && (b = () => {
                                E(!0), a(P)
                            }), tj(P, "ready", b), f.useLayoutEffect(() => {
                                if (null === C.current && null !== j.current && S) {
                                    let t = null;
                                    S && (t = S.create(e, o)), C.current = t, w(t), t && t.mount(j.current)
                                }
                            }, [S, o]);
                            let U = tC(o);
                            return f.useEffect(() => {
                                if (!C.current) return;
                                let e = tx(o, U, ["paymentRequest"]);
                                e && "update" in C.current && C.current.update(e)
                            }, [o, U]), f.useLayoutEffect(() => () => {
                                if (C.current && "function" == typeof C.current.destroy) try {
                                    C.current.destroy(), C.current = null
                                } catch {}
                            }, []), f.createElement(f.Fragment, null, !O && i, f.createElement("div", {
                                id: t,
                                className: n,
                                ref: j
                            }))
                        };
                    return n.displayName = r, n.__elementType = e, n
                })("payment", "undefined" == typeof window),
                [tJ, tq] = eZ("StripeLibsContext"),
                tV = ({
                    children: e
                }) => {
                    let t = ty(),
                        {
                            data: r
                        } = eU("clerk-stripe-sdk", async () => ({
                            loadStripe: await t.__internal_loadStripeJs()
                        }), {
                            keepPreviousData: !0,
                            revalidateOnFocus: !1,
                            dedupingInterval: 1 / 0
                        });
                    return f.createElement(tJ.Provider, {
                        value: {
                            value: r || null
                        }
                    }, e)
                },
                tG = () => ty().__unstable__environment,
                tY = e => {
                    let {
                        organization: t
                    } = tu(), {
                        user: r
                    } = tk(), n = "org" === e ? t : r, i = tq(), {
                        data: o,
                        trigger: s
                    } = eY({
                        key: "commerce-payment-source-initialize",
                        resourceId: n ? .id
                    }, () => n ? .initializePaymentSource({
                        gateway: "stripe"
                    })), l = tG();
                    (0, f.useEffect)(() => {
                        s().catch(() => {})
                    }, []);
                    let a = o ? .externalGatewayId,
                        u = o ? .externalClientSecret,
                        c = o ? .paymentMethodOrder,
                        d = l ? .commerceSettings.billing.stripePublishableKey,
                        {
                            data: p
                        } = eU(i && a && d ? {
                            key: "stripe-sdk",
                            externalGatewayId: a,
                            stripePublishableKey: d
                        } : null, ({
                            stripePublishableKey: e,
                            externalGatewayId: t
                        }) => i ? .loadStripe(e, {
                            stripeAccount: t
                        }), {
                            keepPreviousData: !0,
                            revalidateOnFocus: !1,
                            dedupingInterval: 6e4
                        });
                    return {
                        stripe: p,
                        initializePaymentSource: s,
                        externalClientSecret: u,
                        paymentMethodOrder: c
                    }
                },
                [tH, tZ] = eZ("PaymentElementContext"),
                [tQ, tX] = eZ("StripeUtilsContext"),
                t0 = ({
                    children: e
                }) => {
                    let t = tF(),
                        r = tz();
                    return f.createElement(tQ.Provider, {
                        value: {
                            value: {
                                stripe: t,
                                elements: r
                            }
                        }
                    }, e)
                },
                t1 = ({
                    children: e
                }) => f.createElement(tQ.Provider, {
                    value: {
                        value: {}
                    }
                }, e),
                t2 = ({
                    children: e,
                    ...t
                }) => {
                    let r = tY(t.for),
                        [n, i] = (0, f.useState)(!1);
                    return f.createElement(tH.Provider, {
                        value: {
                            value: { ...t,
                                ...r,
                                setIsPaymentElementReady: i,
                                isPaymentElementReady: n
                            }
                        }
                    }, e)
                },
                t5 = ({
                    children: e,
                    ...t
                }) => f.createElement(tV, null, f.createElement(t2, { ...t
                }, f.createElement(t6, null, e))),
                t6 = e => {
                    let {
                        stripe: t,
                        externalClientSecret: r,
                        stripeAppearance: n
                    } = tZ();
                    return t && r ? f.createElement(tU, {
                        key: r,
                        stripe: t,
                        options: {
                            clientSecret: r,
                            appearance: {
                                variables: n
                            }
                        }
                    }, f.createElement(t0, null, e.children)) : f.createElement(t1, null, e.children)
                },
                t3 = ({
                    fallback: e
                }) => {
                    let {
                        setIsPaymentElementReady: t,
                        paymentMethodOrder: r,
                        checkout: n,
                        stripe: i,
                        externalClientSecret: o,
                        paymentDescription: s,
                        for: l
                    } = tZ(), a = tG(), u = (0, f.useMemo)(() => {
                        if (n && n.totals && n.plan) return {
                            recurringPaymentRequest: {
                                paymentDescription: s || "",
                                managementURL: "org" === l ? a ? .displayConfig.organizationProfileUrl || "" : a ? .displayConfig.userProfileUrl || "",
                                regularBilling: {
                                    amount: n.totals.totalDueNow ? .amount || n.totals.grandTotal.amount,
                                    label: n.plan.name,
                                    recurringPaymentIntervalUnit: "annual" === n.planPeriod ? "year" : "month"
                                }
                            }
                        }
                    }, [n, s, l, a]), c = (0, f.useMemo)(() => ({
                        layout: {
                            type: "tabs",
                            defaultCollapsed: !1
                        },
                        paymentMethodOrder: r,
                        applePay: u
                    }), [u, r]), d = (0, f.useCallback)(() => {
                        t(!0)
                    }, [t]);
                    return i && o ? f.createElement(tK, {
                        fallback: e,
                        onReady: d,
                        options: c
                    }) : f.createElement(f.Fragment, null, e)
                },
                t7 = () => {
                    throw Error("Clerk: Unable to submit, Stripe libraries are not yet loaded. Be sure to check `isFormReady` before calling `submit`.")
                },
                t4 = () => {
                    let {
                        isPaymentElementReady: e,
                        initializePaymentSource: t
                    } = tZ(), {
                        stripe: r,
                        elements: n
                    } = tX(), {
                        externalClientSecret: i
                    } = tZ(), o = (0, f.useCallback)(async () => {
                        if (!r || !n) return t7();
                        let {
                            setupIntent: e,
                            error: t
                        } = await r.confirmSetup({
                            elements: n,
                            confirmParams: {
                                return_url: window.location.href
                            },
                            redirect: "if_required"
                        });
                        return t ? {
                            data: null,
                            error: {
                                gateway: "stripe",
                                error: {
                                    code: t.code,
                                    message: t.message,
                                    type: t.type
                                }
                            }
                        } : {
                            data: {
                                gateway: "stripe",
                                paymentToken: e.payment_method
                            },
                            error: null
                        }
                    }, [r, n]), s = (0, f.useCallback)(async () => {
                        if (!r || !n) return t7();
                        await t()
                    }, [r, n, t]), l = !!(r && i);
                    return l ? {
                        submit: o,
                        reset: s,
                        isFormReady: e,
                        provider: {
                            name: "stripe"
                        },
                        isProviderReady: l
                    } : {
                        submit: t7,
                        reset: t7,
                        isFormReady: !1,
                        provider: void 0,
                        isProviderReady: !1
                    }
                }
        },
        46214: function(e, t, r) {
            "use strict";
            r.d(t, {
                J6: function() {
                    return n.J6
                },
                kD: function() {
                    return n.kD
                }
            });
            var n = r(30226);
            r(65053), r(87732)
        },
        48203: function(e, t, r) {
            "use strict";
            r.d(t, {
                YZ: function() {
                    return o
                },
                vf: function() {
                    return n.vf
                },
                rx: function() {
                    return n.rx
                },
                yJ: function() {
                    return i
                }
            });
            var n = r(62350),
                i = e => {
                    (0, n.vf)() && console.error(`Clerk: ${e}`)
                };

            function o(e, t, r) {
                return "function" == typeof e ? e(t) : void 0 !== e ? e : void 0 !== r ? r : void 0
            }
            r(87732)
        }
    }
]);