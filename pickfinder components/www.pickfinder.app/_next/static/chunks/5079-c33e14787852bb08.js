(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [5079], {
        69948: function(e, t, n) {
            "use strict";
            n.d(t, {
                PromisifiedAuthProvider: function() {
                    return a
                },
                y: function() {
                    return l
                }
            });
            var r = n(69237),
                o = n(88242),
                i = n(81666),
                s = n(55185);
            let u = s.createContext(null);

            function a(e) {
                let {
                    authPromise: t,
                    children: n
                } = e;
                return s.createElement(u.Provider, {
                    value: t
                }, n)
            }

            function l() {
                let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
                    t = (0, i.useRouter)(),
                    n = s.useContext(u),
                    a = n;
                return (n && "then" in n && (a = s.use(n)), "undefined" != typeof window) ? (0, r.aC)({ ...a,
                    ...e
                }) : t ? (0, r.aC)(e) : (0, o.aw)({ ...a,
                    ...e
                })
            }
        },
        63833: function(e, t, n) {
            "use strict";
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Copy", [
                ["rect", {
                    width: "14",
                    height: "14",
                    x: "8",
                    y: "8",
                    rx: "2",
                    ry: "2",
                    key: "17jyea"
                }],
                ["path", {
                    d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
                    key: "zix9uf"
                }]
            ])
        },
        71599: function(e, t, n) {
            "use strict";
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Gift", [
                ["rect", {
                    x: "3",
                    y: "8",
                    width: "18",
                    height: "4",
                    rx: "1",
                    key: "bkv52"
                }],
                ["path", {
                    d: "M12 8v13",
                    key: "1c76mn"
                }],
                ["path", {
                    d: "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7",
                    key: "6wjy6b"
                }],
                ["path", {
                    d: "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
                    key: "1ihvrl"
                }]
            ])
        },
        66961: function(e, t, n) {
            "use strict";
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("LoaderCircle", [
                ["path", {
                    d: "M21 12a9 9 0 1 1-6.219-8.56",
                    key: "13zald"
                }]
            ])
        },
        91e3: function(e, t, n) {
            "use strict";
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("LogOut", [
                ["path", {
                    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
                    key: "1uf3rs"
                }],
                ["polyline", {
                    points: "16 17 21 12 16 7",
                    key: "1gabdz"
                }],
                ["line", {
                    x1: "21",
                    x2: "9",
                    y1: "12",
                    y2: "12",
                    key: "1uyos4"
                }]
            ])
        },
        76840: function(e, t, n) {
            "use strict";
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("TriangleAlert", [
                ["path", {
                    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
                    key: "wmoenq"
                }],
                ["path", {
                    d: "M12 9v4",
                    key: "juzpu7"
                }],
                ["path", {
                    d: "M12 17h.01",
                    key: "p32p05"
                }]
            ])
        },
        81666: function(e, t, n) {
            e.exports = n(5170)
        },
        5170: function(e, t, n) {
            "use strict";
            Object.defineProperty(t, "__esModule", {
                value: !0
            }), Object.defineProperty(t, "useRouter", {
                enumerable: !0,
                get: function() {
                    return i
                }
            });
            let r = n(55185),
                o = n(32069);

            function i() {
                return (0, r.useContext)(o.RouterContext)
            }("function" == typeof t.default || "object" == typeof t.default && null !== t.default) && void 0 === t.default.__esModule && (Object.defineProperty(t.default, "__esModule", {
                value: !0
            }), Object.assign(t.default, t), e.exports = t.default)
        },
        50030: function() {},
        58468: function(e, t, n) {
            "use strict";
            var r = n(72044);
            n(50030);
            var o = n(55185),
                i = o && "object" == typeof o && "default" in o ? o : {
                    default: o
                },
                s = void 0 !== r && r.env && !0,
                u = function(e) {
                    return "[object String]" === Object.prototype.toString.call(e)
                },
                a = function() {
                    function e(e) {
                        var t = void 0 === e ? {} : e,
                            n = t.name,
                            r = void 0 === n ? "stylesheet" : n,
                            o = t.optimizeForSpeed,
                            i = void 0 === o ? s : o;
                        l(u(r), "`name` must be a string"), this._name = r, this._deletedRulePlaceholder = "#" + r + "-deleted-rule____{}", l("boolean" == typeof i, "`optimizeForSpeed` must be a boolean"), this._optimizeForSpeed = i, this._serverSheet = void 0, this._tags = [], this._injected = !1, this._rulesCount = 0;
                        var a = "undefined" != typeof window && document.querySelector('meta[property="csp-nonce"]');
                        this._nonce = a ? a.getAttribute("content") : null
                    }
                    var t = e.prototype;
                    return t.setOptimizeForSpeed = function(e) {
                            l("boolean" == typeof e, "`setOptimizeForSpeed` accepts a boolean"), l(0 === this._rulesCount, "optimizeForSpeed cannot be when rules have already been inserted"), this.flush(), this._optimizeForSpeed = e, this.inject()
                        }, t.isOptimizeForSpeed = function() {
                            return this._optimizeForSpeed
                        }, t.inject = function() {
                            var e = this;
                            if (l(!this._injected, "sheet already injected"), this._injected = !0, "undefined" != typeof window && this._optimizeForSpeed) {
                                this._tags[0] = this.makeStyleTag(this._name), this._optimizeForSpeed = "insertRule" in this.getSheet(), this._optimizeForSpeed || (s || console.warn("StyleSheet: optimizeForSpeed mode not supported falling back to standard mode."), this.flush(), this._injected = !0);
                                return
                            }
                            this._serverSheet = {
                                cssRules: [],
                                insertRule: function(t, n) {
                                    return "number" == typeof n ? e._serverSheet.cssRules[n] = {
                                        cssText: t
                                    } : e._serverSheet.cssRules.push({
                                        cssText: t
                                    }), n
                                },
                                deleteRule: function(t) {
                                    e._serverSheet.cssRules[t] = null
                                }
                            }
                        }, t.getSheetForTag = function(e) {
                            if (e.sheet) return e.sheet;
                            for (var t = 0; t < document.styleSheets.length; t++)
                                if (document.styleSheets[t].ownerNode === e) return document.styleSheets[t]
                        }, t.getSheet = function() {
                            return this.getSheetForTag(this._tags[this._tags.length - 1])
                        }, t.insertRule = function(e, t) {
                            if (l(u(e), "`insertRule` accepts only strings"), "undefined" == typeof window) return "number" != typeof t && (t = this._serverSheet.cssRules.length), this._serverSheet.insertRule(e, t), this._rulesCount++;
                            if (this._optimizeForSpeed) {
                                var n = this.getSheet();
                                "number" != typeof t && (t = n.cssRules.length);
                                try {
                                    n.insertRule(e, t)
                                } catch (t) {
                                    return s || console.warn("StyleSheet: illegal rule: \n\n" + e + "\n\nSee https://stackoverflow.com/q/20007992 for more info"), -1
                                }
                            } else {
                                var r = this._tags[t];
                                this._tags.push(this.makeStyleTag(this._name, e, r))
                            }
                            return this._rulesCount++
                        }, t.replaceRule = function(e, t) {
                            if (this._optimizeForSpeed || "undefined" == typeof window) {
                                var n = "undefined" != typeof window ? this.getSheet() : this._serverSheet;
                                if (t.trim() || (t = this._deletedRulePlaceholder), !n.cssRules[e]) return e;
                                n.deleteRule(e);
                                try {
                                    n.insertRule(t, e)
                                } catch (r) {
                                    s || console.warn("StyleSheet: illegal rule: \n\n" + t + "\n\nSee https://stackoverflow.com/q/20007992 for more info"), n.insertRule(this._deletedRulePlaceholder, e)
                                }
                            } else {
                                var r = this._tags[e];
                                l(r, "old rule at index `" + e + "` not found"), r.textContent = t
                            }
                            return e
                        }, t.deleteRule = function(e) {
                            if ("undefined" == typeof window) {
                                this._serverSheet.deleteRule(e);
                                return
                            }
                            if (this._optimizeForSpeed) this.replaceRule(e, "");
                            else {
                                var t = this._tags[e];
                                l(t, "rule at index `" + e + "` not found"), t.parentNode.removeChild(t), this._tags[e] = null
                            }
                        }, t.flush = function() {
                            this._injected = !1, this._rulesCount = 0, "undefined" != typeof window ? (this._tags.forEach(function(e) {
                                return e && e.parentNode.removeChild(e)
                            }), this._tags = []) : this._serverSheet.cssRules = []
                        }, t.cssRules = function() {
                            var e = this;
                            return "undefined" == typeof window ? this._serverSheet.cssRules : this._tags.reduce(function(t, n) {
                                return n ? t = t.concat(Array.prototype.map.call(e.getSheetForTag(n).cssRules, function(t) {
                                    return t.cssText === e._deletedRulePlaceholder ? null : t
                                })) : t.push(null), t
                            }, [])
                        }, t.makeStyleTag = function(e, t, n) {
                            t && l(u(t), "makeStyleTag accepts only strings as second parameter");
                            var r = document.createElement("style");
                            this._nonce && r.setAttribute("nonce", this._nonce), r.type = "text/css", r.setAttribute("data-" + e, ""), t && r.appendChild(document.createTextNode(t));
                            var o = document.head || document.getElementsByTagName("head")[0];
                            return n ? o.insertBefore(r, n) : o.appendChild(r), r
                        },
                        function(e, t) {
                            for (var n = 0; n < t.length; n++) {
                                var r = t[n];
                                r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r)
                            }
                        }(e.prototype, [{
                            key: "length",
                            get: function() {
                                return this._rulesCount
                            }
                        }]), e
                }();

            function l(e, t) {
                if (!e) throw Error("StyleSheet: " + t + ".")
            }
            var d = function(e) {
                    for (var t = 5381, n = e.length; n;) t = 33 * t ^ e.charCodeAt(--n);
                    return t >>> 0
                },
                c = {};

            function h(e, t) {
                if (!t) return "jsx-" + e;
                var n = String(t),
                    r = e + n;
                return c[r] || (c[r] = "jsx-" + d(e + "-" + n)), c[r]
            }

            function f(e, t) {
                "undefined" == typeof window && (t = t.replace(/\/style/gi, "\\/style"));
                var n = e + t;
                return c[n] || (c[n] = t.replace(/__jsx-style-dynamic-selector/g, e)), c[n]
            }
            var p = function() {
                    function e(e) {
                        var t = void 0 === e ? {} : e,
                            n = t.styleSheet,
                            r = void 0 === n ? null : n,
                            o = t.optimizeForSpeed,
                            i = void 0 !== o && o;
                        this._sheet = r || new a({
                            name: "styled-jsx",
                            optimizeForSpeed: i
                        }), this._sheet.inject(), r && "boolean" == typeof i && (this._sheet.setOptimizeForSpeed(i), this._optimizeForSpeed = this._sheet.isOptimizeForSpeed()), this._fromServer = void 0, this._indices = {}, this._instancesCounts = {}
                    }
                    var t = e.prototype;
                    return t.add = function(e) {
                        var t = this;
                        void 0 === this._optimizeForSpeed && (this._optimizeForSpeed = Array.isArray(e.children), this._sheet.setOptimizeForSpeed(this._optimizeForSpeed), this._optimizeForSpeed = this._sheet.isOptimizeForSpeed()), "undefined" == typeof window || this._fromServer || (this._fromServer = this.selectFromServer(), this._instancesCounts = Object.keys(this._fromServer).reduce(function(e, t) {
                            return e[t] = 0, e
                        }, {}));
                        var n = this.getIdAndRules(e),
                            r = n.styleId,
                            o = n.rules;
                        if (r in this._instancesCounts) {
                            this._instancesCounts[r] += 1;
                            return
                        }
                        var i = o.map(function(e) {
                            return t._sheet.insertRule(e)
                        }).filter(function(e) {
                            return -1 !== e
                        });
                        this._indices[r] = i, this._instancesCounts[r] = 1
                    }, t.remove = function(e) {
                        var t = this,
                            n = this.getIdAndRules(e).styleId;
                        if (function(e, t) {
                                if (!e) throw Error("StyleSheetRegistry: " + t + ".")
                            }(n in this._instancesCounts, "styleId: `" + n + "` not found"), this._instancesCounts[n] -= 1, this._instancesCounts[n] < 1) {
                            var r = this._fromServer && this._fromServer[n];
                            r ? (r.parentNode.removeChild(r), delete this._fromServer[n]) : (this._indices[n].forEach(function(e) {
                                return t._sheet.deleteRule(e)
                            }), delete this._indices[n]), delete this._instancesCounts[n]
                        }
                    }, t.update = function(e, t) {
                        this.add(t), this.remove(e)
                    }, t.flush = function() {
                        this._sheet.flush(), this._sheet.inject(), this._fromServer = void 0, this._indices = {}, this._instancesCounts = {}
                    }, t.cssRules = function() {
                        var e = this,
                            t = this._fromServer ? Object.keys(this._fromServer).map(function(t) {
                                return [t, e._fromServer[t]]
                            }) : [],
                            n = this._sheet.cssRules();
                        return t.concat(Object.keys(this._indices).map(function(t) {
                            return [t, e._indices[t].map(function(e) {
                                return n[e].cssText
                            }).join(e._optimizeForSpeed ? "" : "\n")]
                        }).filter(function(e) {
                            return !!e[1]
                        }))
                    }, t.styles = function(e) {
                        var t, n;
                        return t = this.cssRules(), void 0 === (n = e) && (n = {}), t.map(function(e) {
                            var t = e[0],
                                r = e[1];
                            return i.default.createElement("style", {
                                id: "__" + t,
                                key: "__" + t,
                                nonce: n.nonce ? n.nonce : void 0,
                                dangerouslySetInnerHTML: {
                                    __html: r
                                }
                            })
                        })
                    }, t.getIdAndRules = function(e) {
                        var t = e.children,
                            n = e.dynamic,
                            r = e.id;
                        if (n) {
                            var o = h(r, n);
                            return {
                                styleId: o,
                                rules: Array.isArray(t) ? t.map(function(e) {
                                    return f(o, e)
                                }) : [f(o, t)]
                            }
                        }
                        return {
                            styleId: h(r),
                            rules: Array.isArray(t) ? t : [t]
                        }
                    }, t.selectFromServer = function() {
                        return Array.prototype.slice.call(document.querySelectorAll('[id^="__jsx-"]')).reduce(function(e, t) {
                            return e[t.id.slice(2)] = t, e
                        }, {})
                    }, e
                }(),
                v = o.createContext(null);
            v.displayName = "StyleSheetContext";
            var y = i.default.useInsertionEffect || i.default.useLayoutEffect,
                _ = "undefined" != typeof window ? new p : void 0;

            function m(e) {
                var t = _ || o.useContext(v);
                return t && ("undefined" == typeof window ? t.add(e) : y(function() {
                    return t.add(e),
                        function() {
                            t.remove(e)
                        }
                }, [e.id, String(e.dynamic)])), null
            }
            m.dynamic = function(e) {
                return e.map(function(e) {
                    return h(e[0], e[1])
                }).join(" ")
            }, t.style = m
        },
        70434: function(e, t, n) {
            "use strict";
            e.exports = n(58468).style
        },
        88242: function(e, t, n) {
            "use strict";
            n.d(t, {
                Aw: function() {
                    return o.Aw
                },
                EJ: function() {
                    return i
                },
                JM: function() {
                    return r.JM
                },
                aw: function() {
                    return r.aw
                },
                iv: function() {
                    return o.iv
                },
                wE: function() {
                    return o.wE
                }
            });
            var r = n(66517),
                o = n(82467);

            function i(e, t, n) {
                let o = t.path || (null == n ? void 0 : n.path);
                return "path" === (t.routing || (null == n ? void 0 : n.routing) || "path") ? o ? { ...n,
                    ...t,
                    routing: "path"
                } : r.RM.throw((0, r.Gv)(e)) : t.path ? r.RM.throw((0, r.RE)(e)) : { ...n,
                    ...t,
                    path: void 0
                }
            }
        },
        49940: function(e, t, n) {
            "use strict";
            n.d(t, {
                VY: function() {
                    return H
                },
                fC: function() {
                    return q
                },
                h_: function() {
                    return B
                },
                xz: function() {
                    return L
                }
            });
            var r = n(55185),
                o = n(4142),
                i = n(46121),
                s = n(70358),
                u = n(30521),
                a = n(14074),
                l = n(91926),
                d = n(43794),
                c = n(71872),
                h = n(93958),
                f = n(15624),
                p = n(56366),
                v = n(33658),
                y = n(63485),
                _ = n(34467),
                m = n(13158),
                g = n(10131),
                S = "Popover",
                [w, R] = (0, s.b)(S, [c.D7]),
                x = (0, c.D7)(),
                [C, b] = w(S),
                j = e => {
                    let {
                        __scopePopover: t,
                        children: n,
                        open: o,
                        defaultOpen: i,
                        onOpenChange: s,
                        modal: u = !1
                    } = e, a = x(t), l = r.useRef(null), [h, f] = r.useState(!1), [p = !1, v] = (0, y.T)({
                        prop: o,
                        defaultProp: i,
                        onChange: s
                    });
                    return (0, g.jsx)(c.fC, { ...a,
                        children: (0, g.jsx)(C, {
                            scope: t,
                            contentId: (0, d.M)(),
                            triggerRef: l,
                            open: p,
                            onOpenChange: v,
                            onOpenToggle: r.useCallback(() => v(e => !e), [v]),
                            hasCustomAnchor: h,
                            onCustomAnchorAdd: r.useCallback(() => f(!0), []),
                            onCustomAnchorRemove: r.useCallback(() => f(!1), []),
                            modal: u,
                            children: n
                        })
                    })
                };
            j.displayName = S;
            var F = "PopoverAnchor";
            r.forwardRef((e, t) => {
                let {
                    __scopePopover: n,
                    ...o
                } = e, i = b(F, n), s = x(n), {
                    onCustomAnchorAdd: u,
                    onCustomAnchorRemove: a
                } = i;
                return r.useEffect(() => (u(), () => a()), [u, a]), (0, g.jsx)(c.ee, { ...s,
                    ...o,
                    ref: t
                })
            }).displayName = F;
            var k = "PopoverTrigger",
                z = r.forwardRef((e, t) => {
                    let {
                        __scopePopover: n,
                        ...r
                    } = e, s = b(k, n), u = x(n), a = (0, i.e)(t, s.triggerRef), l = (0, g.jsx)(p.WV.button, {
                        type: "button",
                        "aria-haspopup": "dialog",
                        "aria-expanded": s.open,
                        "aria-controls": s.contentId,
                        "data-state": V(s.open),
                        ...r,
                        ref: a,
                        onClick: (0, o.M)(e.onClick, s.onOpenToggle)
                    });
                    return s.hasCustomAnchor ? l : (0, g.jsx)(c.ee, {
                        asChild: !0,
                        ...u,
                        children: l
                    })
                });
            z.displayName = k;
            var A = "PopoverPortal",
                [P, O] = w(A, {
                    forceMount: void 0
                }),
                M = e => {
                    let {
                        __scopePopover: t,
                        forceMount: n,
                        children: r,
                        container: o
                    } = e, i = b(A, t);
                    return (0, g.jsx)(P, {
                        scope: t,
                        forceMount: n,
                        children: (0, g.jsx)(f.z, {
                            present: n || i.open,
                            children: (0, g.jsx)(h.h, {
                                asChild: !0,
                                container: o,
                                children: r
                            })
                        })
                    })
                };
            M.displayName = A;
            var E = "PopoverContent",
                T = r.forwardRef((e, t) => {
                    let n = O(E, e.__scopePopover),
                        {
                            forceMount: r = n.forceMount,
                            ...o
                        } = e,
                        i = b(E, e.__scopePopover);
                    return (0, g.jsx)(f.z, {
                        present: r || i.open,
                        children: i.modal ? (0, g.jsx)(N, { ...o,
                            ref: t
                        }) : (0, g.jsx)(I, { ...o,
                            ref: t
                        })
                    })
                });
            T.displayName = E;
            var N = r.forwardRef((e, t) => {
                    let n = b(E, e.__scopePopover),
                        s = r.useRef(null),
                        u = (0, i.e)(t, s),
                        a = r.useRef(!1);
                    return r.useEffect(() => {
                        let e = s.current;
                        if (e) return (0, _.Ry)(e)
                    }, []), (0, g.jsx)(m.Z, {
                        as: v.g7,
                        allowPinchZoom: !0,
                        children: (0, g.jsx)(D, { ...e,
                            ref: u,
                            trapFocus: n.open,
                            disableOutsidePointerEvents: !0,
                            onCloseAutoFocus: (0, o.M)(e.onCloseAutoFocus, e => {
                                var t;
                                e.preventDefault(), a.current || null === (t = n.triggerRef.current) || void 0 === t || t.focus()
                            }),
                            onPointerDownOutside: (0, o.M)(e.onPointerDownOutside, e => {
                                let t = e.detail.originalEvent,
                                    n = 0 === t.button && !0 === t.ctrlKey,
                                    r = 2 === t.button || n;
                                a.current = r
                            }, {
                                checkForDefaultPrevented: !1
                            }),
                            onFocusOutside: (0, o.M)(e.onFocusOutside, e => e.preventDefault(), {
                                checkForDefaultPrevented: !1
                            })
                        })
                    })
                }),
                I = r.forwardRef((e, t) => {
                    let n = b(E, e.__scopePopover),
                        o = r.useRef(!1),
                        i = r.useRef(!1);
                    return (0, g.jsx)(D, { ...e,
                        ref: t,
                        trapFocus: !1,
                        disableOutsidePointerEvents: !1,
                        onCloseAutoFocus: t => {
                            var r, s;
                            null === (r = e.onCloseAutoFocus) || void 0 === r || r.call(e, t), t.defaultPrevented || (o.current || null === (s = n.triggerRef.current) || void 0 === s || s.focus(), t.preventDefault()), o.current = !1, i.current = !1
                        },
                        onInteractOutside: t => {
                            var r, s;
                            null === (r = e.onInteractOutside) || void 0 === r || r.call(e, t), t.defaultPrevented || (o.current = !0, "pointerdown" !== t.detail.originalEvent.type || (i.current = !0));
                            let u = t.target;
                            (null === (s = n.triggerRef.current) || void 0 === s ? void 0 : s.contains(u)) && t.preventDefault(), "focusin" === t.detail.originalEvent.type && i.current && t.preventDefault()
                        }
                    })
                }),
                D = r.forwardRef((e, t) => {
                    let {
                        __scopePopover: n,
                        trapFocus: r,
                        onOpenAutoFocus: o,
                        onCloseAutoFocus: i,
                        disableOutsidePointerEvents: s,
                        onEscapeKeyDown: d,
                        onPointerDownOutside: h,
                        onFocusOutside: f,
                        onInteractOutside: p,
                        ...v
                    } = e, y = b(E, n), _ = x(n);
                    return (0, a.EW)(), (0, g.jsx)(l.M, {
                        asChild: !0,
                        loop: !0,
                        trapped: r,
                        onMountAutoFocus: o,
                        onUnmountAutoFocus: i,
                        children: (0, g.jsx)(u.XB, {
                            asChild: !0,
                            disableOutsidePointerEvents: s,
                            onInteractOutside: p,
                            onEscapeKeyDown: d,
                            onPointerDownOutside: h,
                            onFocusOutside: f,
                            onDismiss: () => y.onOpenChange(!1),
                            children: (0, g.jsx)(c.VY, {
                                "data-state": V(y.open),
                                role: "dialog",
                                id: y.contentId,
                                ..._,
                                ...v,
                                ref: t,
                                style: { ...v.style,
                                    "--radix-popover-content-transform-origin": "var(--radix-popper-transform-origin)",
                                    "--radix-popover-content-available-width": "var(--radix-popper-available-width)",
                                    "--radix-popover-content-available-height": "var(--radix-popper-available-height)",
                                    "--radix-popover-trigger-width": "var(--radix-popper-anchor-width)",
                                    "--radix-popover-trigger-height": "var(--radix-popper-anchor-height)"
                                }
                            })
                        })
                    })
                }),
                Z = "PopoverClose";

            function V(e) {
                return e ? "open" : "closed"
            }
            r.forwardRef((e, t) => {
                let {
                    __scopePopover: n,
                    ...r
                } = e, i = b(Z, n);
                return (0, g.jsx)(p.WV.button, {
                    type: "button",
                    ...r,
                    ref: t,
                    onClick: (0, o.M)(e.onClick, () => i.onOpenChange(!1))
                })
            }).displayName = Z, r.forwardRef((e, t) => {
                let {
                    __scopePopover: n,
                    ...r
                } = e, o = x(n);
                return (0, g.jsx)(c.Eh, { ...o,
                    ...r,
                    ref: t
                })
            }).displayName = "PopoverArrow";
            var q = j,
                L = z,
                B = M,
                H = T
        }
    }
]);