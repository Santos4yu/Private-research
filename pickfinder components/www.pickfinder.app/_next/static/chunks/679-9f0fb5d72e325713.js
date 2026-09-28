"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [679], {
        40122: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("X", [
                ["path", {
                    d: "M18 6 6 18",
                    key: "1bl5f8"
                }],
                ["path", {
                    d: "m6 6 12 12",
                    key: "d8bk6v"
                }]
            ])
        },
        92238: function(e, t, n) {
            n.d(t, {
                Av: function() {
                    return i
                },
                pF: function() {
                    return r
                },
                xv: function() {
                    return u
                },
                zi: function() {
                    return o
                }
            });
            var r = "right-scroll-bar-position",
                o = "width-before-scroll-bar",
                u = "with-scroll-bars-hidden",
                i = "--removed-body-scroll-bar-size"
        },
        78217: function(e, t, n) {
            n.d(t, {
                jp: function() {
                    return m
                }
            });
            var r = n(55185),
                o = n(71339),
                u = n(92238),
                i = {
                    left: 0,
                    top: 0,
                    right: 0,
                    gap: 0
                },
                a = function(e) {
                    return parseInt(e || "", 10) || 0
                },
                c = function(e) {
                    var t = window.getComputedStyle(document.body),
                        n = t["padding" === e ? "paddingLeft" : "marginLeft"],
                        r = t["padding" === e ? "paddingTop" : "marginTop"],
                        o = t["padding" === e ? "paddingRight" : "marginRight"];
                    return [a(n), a(r), a(o)]
                },
                l = function(e) {
                    if (void 0 === e && (e = "margin"), "undefined" == typeof window) return i;
                    var t = c(e),
                        n = document.documentElement.clientWidth,
                        r = window.innerWidth;
                    return {
                        left: t[0],
                        top: t[1],
                        right: t[2],
                        gap: Math.max(0, r - n + t[2] - t[0])
                    }
                },
                s = (0, o.Ws)(),
                d = "data-scroll-locked",
                f = function(e, t, n, r) {
                    var o = e.left,
                        i = e.top,
                        a = e.right,
                        c = e.gap;
                    return void 0 === n && (n = "margin"), "\n  .".concat(u.xv, " {\n   overflow: hidden ").concat(r, ";\n   padding-right: ").concat(c, "px ").concat(r, ";\n  }\n  body[").concat(d, "] {\n    overflow: hidden ").concat(r, ";\n    overscroll-behavior: contain;\n    ").concat([t && "position: relative ".concat(r, ";"), "margin" === n && "\n    padding-left: ".concat(o, "px;\n    padding-top: ").concat(i, "px;\n    padding-right: ").concat(a, "px;\n    margin-left:0;\n    margin-top:0;\n    margin-right: ").concat(c, "px ").concat(r, ";\n    "), "padding" === n && "padding-right: ".concat(c, "px ").concat(r, ";")].filter(Boolean).join(""), "\n  }\n  \n  .").concat(u.pF, " {\n    right: ").concat(c, "px ").concat(r, ";\n  }\n  \n  .").concat(u.zi, " {\n    margin-right: ").concat(c, "px ").concat(r, ";\n  }\n  \n  .").concat(u.pF, " .").concat(u.pF, " {\n    right: 0 ").concat(r, ";\n  }\n  \n  .").concat(u.zi, " .").concat(u.zi, " {\n    margin-right: 0 ").concat(r, ";\n  }\n  \n  body[").concat(d, "] {\n    ").concat(u.Av, ": ").concat(c, "px;\n  }\n")
                },
                v = function() {
                    var e = parseInt(document.body.getAttribute(d) || "0", 10);
                    return isFinite(e) ? e : 0
                },
                p = function() {
                    r.useEffect(function() {
                        return document.body.setAttribute(d, (v() + 1).toString()),
                            function() {
                                var e = v() - 1;
                                e <= 0 ? document.body.removeAttribute(d) : document.body.setAttribute(d, e.toString())
                            }
                    }, [])
                },
                m = function(e) {
                    var t = e.noRelative,
                        n = e.noImportant,
                        o = e.gapMode,
                        u = void 0 === o ? "margin" : o;
                    p();
                    var i = r.useMemo(function() {
                        return l(u)
                    }, [u]);
                    return r.createElement(s, {
                        styles: f(i, !t, u, n ? "" : "!important")
                    })
                }
        },
        13158: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return O
                }
            });
            var r = function() {
                return (r = Object.assign || function(e) {
                    for (var t, n = 1, r = arguments.length; n < r; n++)
                        for (var o in t = arguments[n]) Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
                    return e
                }).apply(this, arguments)
            };
            "function" == typeof SuppressedError && SuppressedError;
            var o = n(55185),
                u = n(92238),
                i = n(16741),
                a = (0, n(54640)._)(),
                c = function() {},
                l = o.forwardRef(function(e, t) {
                    var n = o.useRef(null),
                        u = o.useState({
                            onScrollCapture: c,
                            onWheelCapture: c,
                            onTouchMoveCapture: c
                        }),
                        l = u[0],
                        s = u[1],
                        d = e.forwardProps,
                        f = e.children,
                        v = e.className,
                        p = e.removeScrollBar,
                        m = e.enabled,
                        h = e.shards,
                        g = e.sideCar,
                        y = e.noIsolation,
                        b = e.inert,
                        E = e.allowPinchZoom,
                        w = e.as,
                        C = e.gapMode,
                        N = function(e, t) {
                            var n = {};
                            for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && 0 > t.indexOf(r) && (n[r] = e[r]);
                            if (null != e && "function" == typeof Object.getOwnPropertySymbols)
                                for (var o = 0, r = Object.getOwnPropertySymbols(e); o < r.length; o++) 0 > t.indexOf(r[o]) && Object.prototype.propertyIsEnumerable.call(e, r[o]) && (n[r[o]] = e[r[o]]);
                            return n
                        }(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]),
                        x = (0, i.q)([n, t]),
                        R = r(r({}, N), l);
                    return o.createElement(o.Fragment, null, m && o.createElement(g, {
                        sideCar: a,
                        removeScrollBar: p,
                        shards: h,
                        noIsolation: y,
                        inert: b,
                        setCallbacks: s,
                        allowPinchZoom: !!E,
                        lockRef: n,
                        gapMode: C
                    }), d ? o.cloneElement(o.Children.only(f), r(r({}, R), {
                        ref: x
                    })) : o.createElement(void 0 === w ? "div" : w, r({}, R, {
                        className: v,
                        ref: x
                    }), f))
                });
            l.defaultProps = {
                enabled: !0,
                removeScrollBar: !0,
                inert: !1
            }, l.classNames = {
                fullWidth: u.zi,
                zeroRight: u.pF
            };
            var s = n(30774),
                d = n(78217),
                f = n(71339),
                v = !1;
            if ("undefined" != typeof window) try {
                var p = Object.defineProperty({}, "passive", {
                    get: function() {
                        return v = !0, !0
                    }
                });
                window.addEventListener("test", p, p), window.removeEventListener("test", p, p)
            } catch (e) {
                v = !1
            }
            var m = !!v && {
                    passive: !1
                },
                h = function(e, t) {
                    var n = window.getComputedStyle(e);
                    return "hidden" !== n[t] && !(n.overflowY === n.overflowX && "TEXTAREA" !== e.tagName && "visible" === n[t])
                },
                g = function(e, t) {
                    var n = t.ownerDocument,
                        r = t;
                    do {
                        if ("undefined" != typeof ShadowRoot && r instanceof ShadowRoot && (r = r.host), y(e, r)) {
                            var o = b(e, r);
                            if (o[1] > o[2]) return !0
                        }
                        r = r.parentNode
                    } while (r && r !== n.body);
                    return !1
                },
                y = function(e, t) {
                    return "v" === e ? h(t, "overflowY") : h(t, "overflowX")
                },
                b = function(e, t) {
                    return "v" === e ? [t.scrollTop, t.scrollHeight, t.clientHeight] : [t.scrollLeft, t.scrollWidth, t.clientWidth]
                },
                E = function(e, t, n, r, o) {
                    var u, i = (u = window.getComputedStyle(t).direction, "h" === e && "rtl" === u ? -1 : 1),
                        a = i * r,
                        c = n.target,
                        l = t.contains(c),
                        s = !1,
                        d = a > 0,
                        f = 0,
                        v = 0;
                    do {
                        var p = b(e, c),
                            m = p[0],
                            h = p[1] - p[2] - i * m;
                        (m || h) && y(e, c) && (f += h, v += m), c instanceof ShadowRoot ? c = c.host : c = c.parentNode
                    } while (!l && c !== document.body || l && (t.contains(c) || t === c));
                    return d && (o && 1 > Math.abs(f) || !o && a > f) ? s = !0 : !d && (o && 1 > Math.abs(v) || !o && -a > v) && (s = !0), s
                },
                w = function(e) {
                    return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0]
                },
                C = function(e) {
                    return [e.deltaX, e.deltaY]
                },
                N = function(e) {
                    return e && "current" in e ? e.current : e
                },
                x = 0,
                R = [],
                S = (0, s.L)(a, function(e) {
                    var t = o.useRef([]),
                        n = o.useRef([0, 0]),
                        r = o.useRef(),
                        u = o.useState(x++)[0],
                        i = o.useState(f.Ws)[0],
                        a = o.useRef(e);
                    o.useEffect(function() {
                        a.current = e
                    }, [e]), o.useEffect(function() {
                        if (e.inert) {
                            document.body.classList.add("block-interactivity-".concat(u));
                            var t = (function(e, t, n) {
                                if (n || 2 == arguments.length)
                                    for (var r, o = 0, u = t.length; o < u; o++) !r && o in t || (r || (r = Array.prototype.slice.call(t, 0, o)), r[o] = t[o]);
                                return e.concat(r || Array.prototype.slice.call(t))
                            })([e.lockRef.current], (e.shards || []).map(N), !0).filter(Boolean);
                            return t.forEach(function(e) {
                                    return e.classList.add("allow-interactivity-".concat(u))
                                }),
                                function() {
                                    document.body.classList.remove("block-interactivity-".concat(u)), t.forEach(function(e) {
                                        return e.classList.remove("allow-interactivity-".concat(u))
                                    })
                                }
                        }
                    }, [e.inert, e.lockRef.current, e.shards]);
                    var c = o.useCallback(function(e, t) {
                            if ("touches" in e && 2 === e.touches.length) return !a.current.allowPinchZoom;
                            var o, u = w(e),
                                i = n.current,
                                c = "deltaX" in e ? e.deltaX : i[0] - u[0],
                                l = "deltaY" in e ? e.deltaY : i[1] - u[1],
                                s = e.target,
                                d = Math.abs(c) > Math.abs(l) ? "h" : "v";
                            if ("touches" in e && "h" === d && "range" === s.type) return !1;
                            var f = g(d, s);
                            if (!f) return !0;
                            if (f ? o = d : (o = "v" === d ? "h" : "v", f = g(d, s)), !f) return !1;
                            if (!r.current && "changedTouches" in e && (c || l) && (r.current = o), !o) return !0;
                            var v = r.current || o;
                            return E(v, t, e, "h" === v ? c : l, !0)
                        }, []),
                        l = o.useCallback(function(e) {
                            if (R.length && R[R.length - 1] === i) {
                                var n = "deltaY" in e ? C(e) : w(e),
                                    r = t.current.filter(function(t) {
                                        var r;
                                        return t.name === e.type && (t.target === e.target || e.target === t.shadowParent) && (r = t.delta)[0] === n[0] && r[1] === n[1]
                                    })[0];
                                if (r && r.should) {
                                    e.cancelable && e.preventDefault();
                                    return
                                }
                                if (!r) {
                                    var o = (a.current.shards || []).map(N).filter(Boolean).filter(function(t) {
                                        return t.contains(e.target)
                                    });
                                    (o.length > 0 ? c(e, o[0]) : !a.current.noIsolation) && e.cancelable && e.preventDefault()
                                }
                            }
                        }, []),
                        s = o.useCallback(function(e, n, r, o) {
                            var u = {
                                name: e,
                                delta: n,
                                target: r,
                                should: o,
                                shadowParent: function(e) {
                                    for (var t = null; null !== e;) e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
                                    return t
                                }(r)
                            };
                            t.current.push(u), setTimeout(function() {
                                t.current = t.current.filter(function(e) {
                                    return e !== u
                                })
                            }, 1)
                        }, []),
                        v = o.useCallback(function(e) {
                            n.current = w(e), r.current = void 0
                        }, []),
                        p = o.useCallback(function(t) {
                            s(t.type, C(t), t.target, c(t, e.lockRef.current))
                        }, []),
                        h = o.useCallback(function(t) {
                            s(t.type, w(t), t.target, c(t, e.lockRef.current))
                        }, []);
                    o.useEffect(function() {
                        return R.push(i), e.setCallbacks({
                                onScrollCapture: p,
                                onWheelCapture: p,
                                onTouchMoveCapture: h
                            }), document.addEventListener("wheel", l, m), document.addEventListener("touchmove", l, m), document.addEventListener("touchstart", v, m),
                            function() {
                                R = R.filter(function(e) {
                                    return e !== i
                                }), document.removeEventListener("wheel", l, m), document.removeEventListener("touchmove", l, m), document.removeEventListener("touchstart", v, m)
                            }
                    }, []);
                    var y = e.removeScrollBar,
                        b = e.inert;
                    return o.createElement(o.Fragment, null, b ? o.createElement(i, {
                        styles: "\n  .block-interactivity-".concat(u, " {pointer-events: none;}\n  .allow-interactivity-").concat(u, " {pointer-events: all;}\n")
                    }) : null, y ? o.createElement(d.jp, {
                        gapMode: e.gapMode
                    }) : null)
                }),
                M = o.forwardRef(function(e, t) {
                    return o.createElement(l, r({}, e, {
                        ref: t,
                        sideCar: S
                    }))
                });
            M.classNames = l.classNames;
            var O = M
        },
        71339: function(e, t, n) {
            n.d(t, {
                Ws: function() {
                    return a
                }
            });
            var r = n(55185),
                o = n(84062),
                u = function() {
                    var e = 0,
                        t = null;
                    return {
                        add: function(n) {
                            if (0 == e && (t = function() {
                                    if (!document) return null;
                                    var e = document.createElement("style");
                                    e.type = "text/css";
                                    var t = (0, o.V)();
                                    return t && e.setAttribute("nonce", t), e
                                }())) {
                                var r, u;
                                (r = t).styleSheet ? r.styleSheet.cssText = n : r.appendChild(document.createTextNode(n)), u = t, (document.head || document.getElementsByTagName("head")[0]).appendChild(u)
                            }
                            e++
                        },
                        remove: function() {
                            --e || !t || (t.parentNode && t.parentNode.removeChild(t), t = null)
                        }
                    }
                },
                i = function() {
                    var e = u();
                    return function(t, n) {
                        r.useEffect(function() {
                            return e.add(t),
                                function() {
                                    e.remove()
                                }
                        }, [t && n])
                    }
                },
                a = function() {
                    var e = i();
                    return function(t) {
                        return e(t.styles, t.dynamic), null
                    }
                }
        },
        16741: function(e, t, n) {
            n.d(t, {
                q: function() {
                    return a
                }
            });
            var r = n(55185);

            function o(e, t) {
                return "function" == typeof e ? e(t) : e && (e.current = t), e
            }
            var u = "undefined" != typeof window ? r.useLayoutEffect : r.useEffect,
                i = new WeakMap;

            function a(e, t) {
                var n, a, c, l = (n = t || null, a = function(t) {
                    return e.forEach(function(e) {
                        return o(e, t)
                    })
                }, (c = (0, r.useState)(function() {
                    return {
                        value: n,
                        callback: a,
                        facade: {
                            get current() {
                                return c.value
                            },
                            set current(value) {
                                var e = c.value;
                                e !== value && (c.value = value, c.callback(value, e))
                            }
                        }
                    }
                })[0]).callback = a, c.facade);
                return u(function() {
                    var t = i.get(l);
                    if (t) {
                        var n = new Set(t),
                            r = new Set(e),
                            u = l.current;
                        n.forEach(function(e) {
                            r.has(e) || o(e, null)
                        }), r.forEach(function(e) {
                            n.has(e) || o(e, u)
                        })
                    }
                    i.set(l, e)
                }, [e]), l
            }
        },
        30774: function(e, t, n) {
            n.d(t, {
                L: function() {
                    return i
                }
            });
            var r = n(37826),
                o = n(55185),
                u = function(e) {
                    var t = e.sideCar,
                        n = (0, r._T)(e, ["sideCar"]);
                    if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
                    var u = t.read();
                    if (!u) throw Error("Sidecar medium not found");
                    return o.createElement(u, (0, r.pi)({}, n))
                };

            function i(e, t) {
                return e.useMedium(t), u
            }
            u.isSideCarExport = !0
        },
        54640: function(e, t, n) {
            n.d(t, {
                _: function() {
                    return u
                }
            });
            var r = n(37826);

            function o(e) {
                return e
            }

            function u(e) {
                void 0 === e && (e = {});
                var t, n, u, i = (void 0 === t && (t = o), n = [], u = !1, {
                    read: function() {
                        if (u) throw Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
                        return n.length ? n[n.length - 1] : null
                    },
                    useMedium: function(e) {
                        var r = t(e, u);
                        return n.push(r),
                            function() {
                                n = n.filter(function(e) {
                                    return e !== r
                                })
                            }
                    },
                    assignSyncMedium: function(e) {
                        for (u = !0; n.length;) {
                            var t = n;
                            n = [], t.forEach(e)
                        }
                        n = {
                            push: function(t) {
                                return e(t)
                            },
                            filter: function() {
                                return n
                            }
                        }
                    },
                    assignMedium: function(e) {
                        u = !0;
                        var t = [];
                        if (n.length) {
                            var r = n;
                            n = [], r.forEach(e), t = n
                        }
                        var o = function() {
                                var n = t;
                                t = [], n.forEach(e)
                            },
                            i = function() {
                                return Promise.resolve().then(o)
                            };
                        i(), n = {
                            push: function(e) {
                                t.push(e), i()
                            },
                            filter: function(e) {
                                return t = t.filter(e), n
                            }
                        }
                    }
                });
                return i.options = (0, r.pi)({
                    async: !0,
                    ssr: !1
                }, e), i
            }
        },
        4142: function(e, t, n) {
            n.d(t, {
                M: function() {
                    return r
                }
            });

            function r(e, t, {
                checkForDefaultPrevented: n = !0
            } = {}) {
                return function(r) {
                    if (e ? .(r), !1 === n || !r.defaultPrevented) return t ? .(r)
                }
            }
        },
        70358: function(e, t, n) {
            n.d(t, {
                b: function() {
                    return i
                },
                k: function() {
                    return u
                }
            });
            var r = n(55185),
                o = n(10131);

            function u(e, t) {
                let n = r.createContext(t);

                function u(e) {
                    let {
                        children: t,
                        ...u
                    } = e, i = r.useMemo(() => u, Object.values(u));
                    return (0, o.jsx)(n.Provider, {
                        value: i,
                        children: t
                    })
                }
                return u.displayName = e + "Provider", [u, function(o) {
                    let u = r.useContext(n);
                    if (u) return u;
                    if (void 0 !== t) return t;
                    throw Error(`\`${o}\` must be used within \`${e}\``)
                }]
            }

            function i(e, t = []) {
                let n = [],
                    u = () => {
                        let t = n.map(e => r.createContext(e));
                        return function(n) {
                            let o = n ? .[e] || t;
                            return r.useMemo(() => ({
                                [`__scope${e}`]: { ...n,
                                    [e]: o
                                }
                            }), [n, o])
                        }
                    };
                return u.scopeName = e, [function(t, u) {
                    let i = r.createContext(u),
                        a = n.length;

                    function c(t) {
                        let {
                            scope: n,
                            children: u,
                            ...c
                        } = t, l = n ? .[e][a] || i, s = r.useMemo(() => c, Object.values(c));
                        return (0, o.jsx)(l.Provider, {
                            value: s,
                            children: u
                        })
                    }
                    return n = [...n, u], c.displayName = t + "Provider", [c, function(n, o) {
                        let c = o ? .[e][a] || i,
                            l = r.useContext(c);
                        if (l) return l;
                        if (void 0 !== u) return u;
                        throw Error(`\`${n}\` must be used within \`${t}\``)
                    }]
                }, function(...e) {
                    let t = e[0];
                    if (1 === e.length) return t;
                    let n = () => {
                        let n = e.map(e => ({
                            useScope: e(),
                            scopeName: e.scopeName
                        }));
                        return function(e) {
                            let o = n.reduce((t, {
                                useScope: n,
                                scopeName: r
                            }) => {
                                let o = n(e)[`__scope${r}`];
                                return { ...t,
                                    ...o
                                }
                            }, {});
                            return r.useMemo(() => ({
                                [`__scope${t.scopeName}`]: o
                            }), [o])
                        }
                    };
                    return n.scopeName = t.scopeName, n
                }(u, ...t)]
            }
        },
        31468: function(e, t, n) {
            n.d(t, {
                Dx: function() {
                    return en
                },
                VY: function() {
                    return et
                },
                aV: function() {
                    return ee
                },
                dk: function() {
                    return er
                },
                fC: function() {
                    return G
                },
                h_: function() {
                    return Q
                },
                jm: function() {
                    return $
                },
                p8: function() {
                    return w
                },
                x8: function() {
                    return eo
                },
                xz: function() {
                    return J
                }
            });
            var r = n(55185),
                o = n(4142),
                u = n(46121),
                i = n(70358),
                a = n(43794),
                c = n(63485),
                l = n(30521),
                s = n(91926),
                d = n(93958),
                f = n(15624),
                v = n(56366),
                p = n(14074),
                m = n(13158),
                h = n(34467),
                g = n(33658),
                y = n(10131),
                b = "Dialog",
                [E, w] = (0, i.b)(b),
                [C, N] = E(b),
                x = e => {
                    let {
                        __scopeDialog: t,
                        children: n,
                        open: o,
                        defaultOpen: u,
                        onOpenChange: i,
                        modal: l = !0
                    } = e, s = r.useRef(null), d = r.useRef(null), [f = !1, v] = (0, c.T)({
                        prop: o,
                        defaultProp: u,
                        onChange: i
                    });
                    return (0, y.jsx)(C, {
                        scope: t,
                        triggerRef: s,
                        contentRef: d,
                        contentId: (0, a.M)(),
                        titleId: (0, a.M)(),
                        descriptionId: (0, a.M)(),
                        open: f,
                        onOpenChange: v,
                        onOpenToggle: r.useCallback(() => v(e => !e), [v]),
                        modal: l,
                        children: n
                    })
                };
            x.displayName = b;
            var R = "DialogTrigger",
                S = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, i = N(R, n), a = (0, u.e)(t, i.triggerRef);
                    return (0, y.jsx)(v.WV.button, {
                        type: "button",
                        "aria-haspopup": "dialog",
                        "aria-expanded": i.open,
                        "aria-controls": i.contentId,
                        "data-state": K(i.open),
                        ...r,
                        ref: a,
                        onClick: (0, o.M)(e.onClick, i.onOpenToggle)
                    })
                });
            S.displayName = R;
            var M = "DialogPortal",
                [O, T] = E(M, {
                    forceMount: void 0
                }),
                P = e => {
                    let {
                        __scopeDialog: t,
                        forceMount: n,
                        children: o,
                        container: u
                    } = e, i = N(M, t);
                    return (0, y.jsx)(O, {
                        scope: t,
                        forceMount: n,
                        children: r.Children.map(o, e => (0, y.jsx)(f.z, {
                            present: n || i.open,
                            children: (0, y.jsx)(d.h, {
                                asChild: !0,
                                container: u,
                                children: e
                            })
                        }))
                    })
                };
            P.displayName = M;
            var D = "DialogOverlay",
                L = r.forwardRef((e, t) => {
                    let n = T(D, e.__scopeDialog),
                        {
                            forceMount: r = n.forceMount,
                            ...o
                        } = e,
                        u = N(D, e.__scopeDialog);
                    return u.modal ? (0, y.jsx)(f.z, {
                        present: r || u.open,
                        children: (0, y.jsx)(j, { ...o,
                            ref: t
                        })
                    }) : null
                });
            L.displayName = D;
            var j = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, o = N(D, n);
                    return (0, y.jsx)(m.Z, {
                        as: g.g7,
                        allowPinchZoom: !0,
                        shards: [o.contentRef],
                        children: (0, y.jsx)(v.WV.div, {
                            "data-state": K(o.open),
                            ...r,
                            ref: t,
                            style: {
                                pointerEvents: "auto",
                                ...r.style
                            }
                        })
                    })
                }),
                k = "DialogContent",
                I = r.forwardRef((e, t) => {
                    let n = T(k, e.__scopeDialog),
                        {
                            forceMount: r = n.forceMount,
                            ...o
                        } = e,
                        u = N(k, e.__scopeDialog);
                    return (0, y.jsx)(f.z, {
                        present: r || u.open,
                        children: u.modal ? (0, y.jsx)(W, { ...o,
                            ref: t
                        }) : (0, y.jsx)(A, { ...o,
                            ref: t
                        })
                    })
                });
            I.displayName = k;
            var W = r.forwardRef((e, t) => {
                    let n = N(k, e.__scopeDialog),
                        i = r.useRef(null),
                        a = (0, u.e)(t, n.contentRef, i);
                    return r.useEffect(() => {
                        let e = i.current;
                        if (e) return (0, h.Ry)(e)
                    }, []), (0, y.jsx)(F, { ...e,
                        ref: a,
                        trapFocus: n.open,
                        disableOutsidePointerEvents: !0,
                        onCloseAutoFocus: (0, o.M)(e.onCloseAutoFocus, e => {
                            var t;
                            e.preventDefault(), null === (t = n.triggerRef.current) || void 0 === t || t.focus()
                        }),
                        onPointerDownOutside: (0, o.M)(e.onPointerDownOutside, e => {
                            let t = e.detail.originalEvent,
                                n = 0 === t.button && !0 === t.ctrlKey;
                            (2 === t.button || n) && e.preventDefault()
                        }),
                        onFocusOutside: (0, o.M)(e.onFocusOutside, e => e.preventDefault())
                    })
                }),
                A = r.forwardRef((e, t) => {
                    let n = N(k, e.__scopeDialog),
                        o = r.useRef(!1),
                        u = r.useRef(!1);
                    return (0, y.jsx)(F, { ...e,
                        ref: t,
                        trapFocus: !1,
                        disableOutsidePointerEvents: !1,
                        onCloseAutoFocus: t => {
                            var r, i;
                            null === (r = e.onCloseAutoFocus) || void 0 === r || r.call(e, t), t.defaultPrevented || (o.current || null === (i = n.triggerRef.current) || void 0 === i || i.focus(), t.preventDefault()), o.current = !1, u.current = !1
                        },
                        onInteractOutside: t => {
                            var r, i;
                            null === (r = e.onInteractOutside) || void 0 === r || r.call(e, t), t.defaultPrevented || (o.current = !0, "pointerdown" !== t.detail.originalEvent.type || (u.current = !0));
                            let a = t.target;
                            (null === (i = n.triggerRef.current) || void 0 === i ? void 0 : i.contains(a)) && t.preventDefault(), "focusin" === t.detail.originalEvent.type && u.current && t.preventDefault()
                        }
                    })
                }),
                F = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        trapFocus: o,
                        onOpenAutoFocus: i,
                        onCloseAutoFocus: a,
                        ...c
                    } = e, d = N(k, n), f = r.useRef(null), v = (0, u.e)(t, f);
                    return (0, p.EW)(), (0, y.jsxs)(y.Fragment, {
                        children: [(0, y.jsx)(s.M, {
                            asChild: !0,
                            loop: !0,
                            trapped: o,
                            onMountAutoFocus: i,
                            onUnmountAutoFocus: a,
                            children: (0, y.jsx)(l.XB, {
                                role: "dialog",
                                id: d.contentId,
                                "aria-describedby": d.descriptionId,
                                "aria-labelledby": d.titleId,
                                "data-state": K(d.open),
                                ...c,
                                ref: v,
                                onDismiss: () => d.onOpenChange(!1)
                            })
                        }), (0, y.jsxs)(y.Fragment, {
                            children: [(0, y.jsx)(H, {
                                titleId: d.titleId
                            }), (0, y.jsx)(q, {
                                contentRef: f,
                                descriptionId: d.descriptionId
                            })]
                        })]
                    })
                }),
                _ = "DialogTitle",
                B = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, o = N(_, n);
                    return (0, y.jsx)(v.WV.h2, {
                        id: o.titleId,
                        ...r,
                        ref: t
                    })
                });
            B.displayName = _;
            var z = "DialogDescription",
                U = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, o = N(z, n);
                    return (0, y.jsx)(v.WV.p, {
                        id: o.descriptionId,
                        ...r,
                        ref: t
                    })
                });
            U.displayName = z;
            var V = "DialogClose",
                X = r.forwardRef((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, u = N(V, n);
                    return (0, y.jsx)(v.WV.button, {
                        type: "button",
                        ...r,
                        ref: t,
                        onClick: (0, o.M)(e.onClick, () => u.onOpenChange(!1))
                    })
                });

            function K(e) {
                return e ? "open" : "closed"
            }
            X.displayName = V;
            var Z = "DialogTitleWarning",
                [$, Y] = (0, i.k)(Z, {
                    contentName: k,
                    titleName: _,
                    docsSlug: "dialog"
                }),
                H = e => {
                    let {
                        titleId: t
                    } = e, n = Y(Z), o = "`".concat(n.contentName, "` requires a `").concat(n.titleName, "` for the component to be accessible for screen reader users.\n\nIf you want to hide the `").concat(n.titleName, "`, you can wrap it with our VisuallyHidden component.\n\nFor more information, see https://radix-ui.com/primitives/docs/components/").concat(n.docsSlug);
                    return r.useEffect(() => {
                        t && !document.getElementById(t) && console.error(o)
                    }, [o, t]), null
                },
                q = e => {
                    let {
                        contentRef: t,
                        descriptionId: n
                    } = e, o = Y("DialogDescriptionWarning"), u = "Warning: Missing `Description` or `aria-describedby={undefined}` for {".concat(o.contentName, "}.");
                    return r.useEffect(() => {
                        var e;
                        let r = null === (e = t.current) || void 0 === e ? void 0 : e.getAttribute("aria-describedby");
                        n && r && !document.getElementById(n) && console.warn(u)
                    }, [u, t, n]), null
                },
                G = x,
                J = S,
                Q = P,
                ee = L,
                et = I,
                en = B,
                er = U,
                eo = X
        },
        30521: function(e, t, n) {
            n.d(t, {
                XB: function() {
                    return f
                }
            });
            var r, o = n(55185),
                u = n(4142),
                i = n(56366),
                a = n(46121),
                c = n(51909),
                l = n(10131),
                s = "dismissableLayer.update",
                d = o.createContext({
                    layers: new Set,
                    layersWithOutsidePointerEventsDisabled: new Set,
                    branches: new Set
                }),
                f = o.forwardRef((e, t) => {
                    var n, f;
                    let {
                        disableOutsidePointerEvents: m = !1,
                        onEscapeKeyDown: h,
                        onPointerDownOutside: g,
                        onFocusOutside: y,
                        onInteractOutside: b,
                        onDismiss: E,
                        ...w
                    } = e, C = o.useContext(d), [N, x] = o.useState(null), R = null !== (f = null == N ? void 0 : N.ownerDocument) && void 0 !== f ? f : null === (n = globalThis) || void 0 === n ? void 0 : n.document, [, S] = o.useState({}), M = (0, a.e)(t, e => x(e)), O = Array.from(C.layers), [T] = [...C.layersWithOutsidePointerEventsDisabled].slice(-1), P = O.indexOf(T), D = N ? O.indexOf(N) : -1, L = C.layersWithOutsidePointerEventsDisabled.size > 0, j = D >= P, k = function(e) {
                        var t;
                        let n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null === (t = globalThis) || void 0 === t ? void 0 : t.document,
                            r = (0, c.W)(e),
                            u = o.useRef(!1),
                            i = o.useRef(() => {});
                        return o.useEffect(() => {
                            let e = e => {
                                    if (e.target && !u.current) {
                                        let t = function() {
                                                p("dismissableLayer.pointerDownOutside", r, o, {
                                                    discrete: !0
                                                })
                                            },
                                            o = {
                                                originalEvent: e
                                            };
                                        "touch" === e.pointerType ? (n.removeEventListener("click", i.current), i.current = t, n.addEventListener("click", i.current, {
                                            once: !0
                                        })) : t()
                                    } else n.removeEventListener("click", i.current);
                                    u.current = !1
                                },
                                t = window.setTimeout(() => {
                                    n.addEventListener("pointerdown", e)
                                }, 0);
                            return () => {
                                window.clearTimeout(t), n.removeEventListener("pointerdown", e), n.removeEventListener("click", i.current)
                            }
                        }, [n, r]), {
                            onPointerDownCapture: () => u.current = !0
                        }
                    }(e => {
                        let t = e.target,
                            n = [...C.branches].some(e => e.contains(t));
                        !j || n || (null == g || g(e), null == b || b(e), e.defaultPrevented || null == E || E())
                    }, R), I = function(e) {
                        var t;
                        let n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null === (t = globalThis) || void 0 === t ? void 0 : t.document,
                            r = (0, c.W)(e),
                            u = o.useRef(!1);
                        return o.useEffect(() => {
                            let e = e => {
                                e.target && !u.current && p("dismissableLayer.focusOutside", r, {
                                    originalEvent: e
                                }, {
                                    discrete: !1
                                })
                            };
                            return n.addEventListener("focusin", e), () => n.removeEventListener("focusin", e)
                        }, [n, r]), {
                            onFocusCapture: () => u.current = !0,
                            onBlurCapture: () => u.current = !1
                        }
                    }(e => {
                        let t = e.target;
                        [...C.branches].some(e => e.contains(t)) || (null == y || y(e), null == b || b(e), e.defaultPrevented || null == E || E())
                    }, R);
                    return ! function(e, t = globalThis ? .document) {
                        let n = (0, c.W)(e);
                        o.useEffect(() => {
                            let e = e => {
                                "Escape" === e.key && n(e)
                            };
                            return t.addEventListener("keydown", e, {
                                capture: !0
                            }), () => t.removeEventListener("keydown", e, {
                                capture: !0
                            })
                        }, [n, t])
                    }(e => {
                        D !== C.layers.size - 1 || (null == h || h(e), !e.defaultPrevented && E && (e.preventDefault(), E()))
                    }, R), o.useEffect(() => {
                        if (N) return m && (0 === C.layersWithOutsidePointerEventsDisabled.size && (r = R.body.style.pointerEvents, R.body.style.pointerEvents = "none"), C.layersWithOutsidePointerEventsDisabled.add(N)), C.layers.add(N), v(), () => {
                            m && 1 === C.layersWithOutsidePointerEventsDisabled.size && (R.body.style.pointerEvents = r)
                        }
                    }, [N, R, m, C]), o.useEffect(() => () => {
                        N && (C.layers.delete(N), C.layersWithOutsidePointerEventsDisabled.delete(N), v())
                    }, [N, C]), o.useEffect(() => {
                        let e = () => S({});
                        return document.addEventListener(s, e), () => document.removeEventListener(s, e)
                    }, []), (0, l.jsx)(i.WV.div, { ...w,
                        ref: M,
                        style: {
                            pointerEvents: L ? j ? "auto" : "none" : void 0,
                            ...e.style
                        },
                        onFocusCapture: (0, u.M)(e.onFocusCapture, I.onFocusCapture),
                        onBlurCapture: (0, u.M)(e.onBlurCapture, I.onBlurCapture),
                        onPointerDownCapture: (0, u.M)(e.onPointerDownCapture, k.onPointerDownCapture)
                    })
                });

            function v() {
                let e = new CustomEvent(s);
                document.dispatchEvent(e)
            }

            function p(e, t, n, r) {
                let {
                    discrete: o
                } = r, u = n.originalEvent.target, a = new CustomEvent(e, {
                    bubbles: !1,
                    cancelable: !0,
                    detail: n
                });
                t && u.addEventListener(e, t, {
                    once: !0
                }), o ? (0, i.jH)(u, a) : u.dispatchEvent(a)
            }
            f.displayName = "DismissableLayer", o.forwardRef((e, t) => {
                let n = o.useContext(d),
                    r = o.useRef(null),
                    u = (0, a.e)(t, r);
                return o.useEffect(() => {
                    let e = r.current;
                    if (e) return n.branches.add(e), () => {
                        n.branches.delete(e)
                    }
                }, [n.branches]), (0, l.jsx)(i.WV.div, { ...e,
                    ref: u
                })
            }).displayName = "DismissableLayerBranch"
        },
        14074: function(e, t, n) {
            n.d(t, {
                EW: function() {
                    return u
                }
            });
            var r = n(55185),
                o = 0;

            function u() {
                r.useEffect(() => {
                    var e, t;
                    let n = document.querySelectorAll("[data-radix-focus-guard]");
                    return document.body.insertAdjacentElement("afterbegin", null !== (e = n[0]) && void 0 !== e ? e : i()), document.body.insertAdjacentElement("beforeend", null !== (t = n[1]) && void 0 !== t ? t : i()), o++, () => {
                        1 === o && document.querySelectorAll("[data-radix-focus-guard]").forEach(e => e.remove()), o--
                    }
                }, [])
            }

            function i() {
                let e = document.createElement("span");
                return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.cssText = "outline: none; opacity: 0; position: fixed; pointer-events: none", e
            }
        },
        91926: function(e, t, n) {
            let r;
            n.d(t, {
                M: function() {
                    return f
                }
            });
            var o = n(55185),
                u = n(46121),
                i = n(56366),
                a = n(51909),
                c = n(10131),
                l = "focusScope.autoFocusOnMount",
                s = "focusScope.autoFocusOnUnmount",
                d = {
                    bubbles: !1,
                    cancelable: !0
                },
                f = o.forwardRef((e, t) => {
                    let {
                        loop: n = !1,
                        trapped: r = !1,
                        onMountAutoFocus: f,
                        onUnmountAutoFocus: g,
                        ...y
                    } = e, [b, E] = o.useState(null), w = (0, a.W)(f), C = (0, a.W)(g), N = o.useRef(null), x = (0, u.e)(t, e => E(e)), R = o.useRef({
                        paused: !1,
                        pause() {
                            this.paused = !0
                        },
                        resume() {
                            this.paused = !1
                        }
                    }).current;
                    o.useEffect(() => {
                        if (r) {
                            let e = function(e) {
                                    if (R.paused || !b) return;
                                    let t = e.target;
                                    b.contains(t) ? N.current = t : m(N.current, {
                                        select: !0
                                    })
                                },
                                t = function(e) {
                                    if (R.paused || !b) return;
                                    let t = e.relatedTarget;
                                    null === t || b.contains(t) || m(N.current, {
                                        select: !0
                                    })
                                };
                            document.addEventListener("focusin", e), document.addEventListener("focusout", t);
                            let n = new MutationObserver(function(e) {
                                if (document.activeElement === document.body)
                                    for (let t of e) t.removedNodes.length > 0 && m(b)
                            });
                            return b && n.observe(b, {
                                childList: !0,
                                subtree: !0
                            }), () => {
                                document.removeEventListener("focusin", e), document.removeEventListener("focusout", t), n.disconnect()
                            }
                        }
                    }, [r, b, R.paused]), o.useEffect(() => {
                        if (b) {
                            h.add(R);
                            let e = document.activeElement;
                            if (!b.contains(e)) {
                                let t = new CustomEvent(l, d);
                                b.addEventListener(l, w), b.dispatchEvent(t), t.defaultPrevented || (function(e) {
                                    let {
                                        select: t = !1
                                    } = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {}, n = document.activeElement;
                                    for (let r of e)
                                        if (m(r, {
                                                select: t
                                            }), document.activeElement !== n) return
                                }(v(b).filter(e => "A" !== e.tagName), {
                                    select: !0
                                }), document.activeElement === e && m(b))
                            }
                            return () => {
                                b.removeEventListener(l, w), setTimeout(() => {
                                    let t = new CustomEvent(s, d);
                                    b.addEventListener(s, C), b.dispatchEvent(t), t.defaultPrevented || m(null != e ? e : document.body, {
                                        select: !0
                                    }), b.removeEventListener(s, C), h.remove(R)
                                }, 0)
                            }
                        }
                    }, [b, w, C, R]);
                    let S = o.useCallback(e => {
                        if (!n && !r || R.paused) return;
                        let t = "Tab" === e.key && !e.altKey && !e.ctrlKey && !e.metaKey,
                            o = document.activeElement;
                        if (t && o) {
                            let t = e.currentTarget,
                                [r, u] = function(e) {
                                    let t = v(e);
                                    return [p(t, e), p(t.reverse(), e)]
                                }(t);
                            r && u ? e.shiftKey || o !== u ? e.shiftKey && o === r && (e.preventDefault(), n && m(u, {
                                select: !0
                            })) : (e.preventDefault(), n && m(r, {
                                select: !0
                            })) : o === t && e.preventDefault()
                        }
                    }, [n, r, R.paused]);
                    return (0, c.jsx)(i.WV.div, {
                        tabIndex: -1,
                        ...y,
                        ref: x,
                        onKeyDown: S
                    })
                });

            function v(e) {
                let t = [],
                    n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
                        acceptNode: e => {
                            let t = "INPUT" === e.tagName && "hidden" === e.type;
                            return e.disabled || e.hidden || t ? NodeFilter.FILTER_SKIP : e.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
                        }
                    });
                for (; n.nextNode();) t.push(n.currentNode);
                return t
            }

            function p(e, t) {
                for (let n of e)
                    if (! function(e, t) {
                            let {
                                upTo: n
                            } = t;
                            if ("hidden" === getComputedStyle(e).visibility) return !0;
                            for (; e && (void 0 === n || e !== n);) {
                                if ("none" === getComputedStyle(e).display) return !0;
                                e = e.parentElement
                            }
                            return !1
                        }(n, {
                            upTo: t
                        })) return n
            }

            function m(e) {
                let {
                    select: t = !1
                } = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
                if (e && e.focus) {
                    var n;
                    let r = document.activeElement;
                    e.focus({
                        preventScroll: !0
                    }), e !== r && (n = e) instanceof HTMLInputElement && "select" in n && t && e.select()
                }
            }
            f.displayName = "FocusScope";
            var h = (r = [], {
                add(e) {
                    let t = r[0];
                    e !== t && (null == t || t.pause()), (r = g(r, e)).unshift(e)
                },
                remove(e) {
                    var t;
                    null === (t = (r = g(r, e))[0]) || void 0 === t || t.resume()
                }
            });

            function g(e, t) {
                let n = [...e],
                    r = n.indexOf(t);
                return -1 !== r && n.splice(r, 1), n
            }
        },
        43794: function(e, t, n) {
            n.d(t, {
                M: function() {
                    return c
                }
            });
            var r, o = n(55185),
                u = n(18680),
                i = (r || (r = n.t(o, 2)))["useId".toString()] || (() => void 0),
                a = 0;

            function c(e) {
                let [t, n] = o.useState(i());
                return (0, u.b)(() => {
                    e || n(e => e ? ? String(a++))
                }, [e]), e || (t ? `radix-${t}` : "")
            }
        },
        93958: function(e, t, n) {
            n.d(t, {
                h: function() {
                    return c
                }
            });
            var r = n(55185),
                o = n(19892),
                u = n(56366),
                i = n(18680),
                a = n(10131),
                c = r.forwardRef((e, t) => {
                    var n, c;
                    let {
                        container: l,
                        ...s
                    } = e, [d, f] = r.useState(!1);
                    (0, i.b)(() => f(!0), []);
                    let v = l || d && (null === (c = globalThis) || void 0 === c ? void 0 : null === (n = c.document) || void 0 === n ? void 0 : n.body);
                    return v ? o.createPortal((0, a.jsx)(u.WV.div, { ...s,
                        ref: t
                    }), v) : null
                });
            c.displayName = "Portal"
        },
        15624: function(e, t, n) {
            n.d(t, {
                z: function() {
                    return a
                }
            });
            var r = n(55185),
                o = n(19892),
                u = n(46121),
                i = n(18680),
                a = e => {
                    var t, n;
                    let a, l;
                    let {
                        present: s,
                        children: d
                    } = e, f = function(e) {
                        var t, n;
                        let [u, a] = r.useState(), l = r.useRef({}), s = r.useRef(e), d = r.useRef("none"), [f, v] = (t = e ? "mounted" : "unmounted", n = {
                            mounted: {
                                UNMOUNT: "unmounted",
                                ANIMATION_OUT: "unmountSuspended"
                            },
                            unmountSuspended: {
                                MOUNT: "mounted",
                                ANIMATION_END: "unmounted"
                            },
                            unmounted: {
                                MOUNT: "mounted"
                            }
                        }, r.useReducer((e, t) => {
                            let r = n[e][t];
                            return null != r ? r : e
                        }, t));
                        return r.useEffect(() => {
                            let e = c(l.current);
                            d.current = "mounted" === f ? e : "none"
                        }, [f]), (0, i.b)(() => {
                            let t = l.current,
                                n = s.current;
                            if (n !== e) {
                                let r = d.current,
                                    o = c(t);
                                e ? v("MOUNT") : "none" === o || (null == t ? void 0 : t.display) === "none" ? v("UNMOUNT") : n && r !== o ? v("ANIMATION_OUT") : v("UNMOUNT"), s.current = e
                            }
                        }, [e, v]), (0, i.b)(() => {
                            if (u) {
                                let e = e => {
                                        let t = c(l.current).includes(e.animationName);
                                        e.target === u && t && o.flushSync(() => v("ANIMATION_END"))
                                    },
                                    t = e => {
                                        e.target === u && (d.current = c(l.current))
                                    };
                                return u.addEventListener("animationstart", t), u.addEventListener("animationcancel", e), u.addEventListener("animationend", e), () => {
                                    u.removeEventListener("animationstart", t), u.removeEventListener("animationcancel", e), u.removeEventListener("animationend", e)
                                }
                            }
                            v("ANIMATION_END")
                        }, [u, v]), {
                            isPresent: ["mounted", "unmountSuspended"].includes(f),
                            ref: r.useCallback(e => {
                                e && (l.current = getComputedStyle(e)), a(e)
                            }, [])
                        }
                    }(s), v = "function" == typeof d ? d({
                        present: f.isPresent
                    }) : r.Children.only(d), p = (0, u.e)(f.ref, (a = null === (t = Object.getOwnPropertyDescriptor(v.props, "ref")) || void 0 === t ? void 0 : t.get) && "isReactWarning" in a && a.isReactWarning ? v.ref : (a = null === (n = Object.getOwnPropertyDescriptor(v, "ref")) || void 0 === n ? void 0 : n.get) && "isReactWarning" in a && a.isReactWarning ? v.props.ref : v.props.ref || v.ref);
                    return "function" == typeof d || f.isPresent ? r.cloneElement(v, {
                        ref: p
                    }) : null
                };

            function c(e) {
                return (null == e ? void 0 : e.animationName) || "none"
            }
            a.displayName = "Presence"
        },
        56366: function(e, t, n) {
            n.d(t, {
                WV: function() {
                    return a
                },
                jH: function() {
                    return c
                }
            });
            var r = n(55185),
                o = n(19892),
                u = n(33658),
                i = n(10131),
                a = ["a", "button", "div", "form", "h2", "h3", "img", "input", "label", "li", "nav", "ol", "p", "span", "svg", "ul"].reduce((e, t) => {
                    let n = r.forwardRef((e, n) => {
                        let {
                            asChild: r,
                            ...o
                        } = e, a = r ? u.g7 : t;
                        return "undefined" != typeof window && (window[Symbol.for("radix-ui")] = !0), (0, i.jsx)(a, { ...o,
                            ref: n
                        })
                    });
                    return n.displayName = `Primitive.${t}`, { ...e,
                        [t]: n
                    }
                }, {});

            function c(e, t) {
                e && o.flushSync(() => e.dispatchEvent(t))
            }
        },
        51909: function(e, t, n) {
            n.d(t, {
                W: function() {
                    return o
                }
            });
            var r = n(55185);

            function o(e) {
                let t = r.useRef(e);
                return r.useEffect(() => {
                    t.current = e
                }), r.useMemo(() => (...e) => t.current ? .(...e), [])
            }
        },
        63485: function(e, t, n) {
            n.d(t, {
                T: function() {
                    return u
                }
            });
            var r = n(55185),
                o = n(51909);

            function u({
                prop: e,
                defaultProp: t,
                onChange: n = () => {}
            }) {
                let [u, i] = function({
                    defaultProp: e,
                    onChange: t
                }) {
                    let n = r.useState(e),
                        [u] = n,
                        i = r.useRef(u),
                        a = (0, o.W)(t);
                    return r.useEffect(() => {
                        i.current !== u && (a(u), i.current = u)
                    }, [u, i, a]), n
                }({
                    defaultProp: t,
                    onChange: n
                }), a = void 0 !== e, c = a ? e : u, l = (0, o.W)(n);
                return [c, r.useCallback(t => {
                    if (a) {
                        let n = "function" == typeof t ? t(e) : t;
                        n !== e && l(n)
                    } else i(t)
                }, [a, e, i, l])]
            }
        },
        18680: function(e, t, n) {
            n.d(t, {
                b: function() {
                    return o
                }
            });
            var r = n(55185),
                o = globalThis ? .document ? r.useLayoutEffect : () => {}
        }
    }
]);