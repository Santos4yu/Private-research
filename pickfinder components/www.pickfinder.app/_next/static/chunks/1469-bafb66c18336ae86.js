"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [1469], {
        69948: function(e, t, r) {
            r.d(t, {
                PromisifiedAuthProvider: function() {
                    return u
                },
                y: function() {
                    return c
                }
            });
            var n = r(69237),
                o = r(88242),
                l = r(81666),
                i = r(55185);
            let a = i.createContext(null);

            function u(e) {
                let {
                    authPromise: t,
                    children: r
                } = e;
                return i.createElement(a.Provider, {
                    value: t
                }, r)
            }

            function c() {
                let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
                    t = (0, l.useRouter)(),
                    r = i.useContext(a),
                    u = r;
                return (r && "then" in r && (u = i.use(r)), "undefined" != typeof window) ? (0, n.aC)({ ...u,
                    ...e
                }) : t ? (0, n.aC)(e) : (0, o.aw)({ ...u,
                    ...e
                })
            }
        },
        70083: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ChartNoAxesColumn", [
                ["line", {
                    x1: "18",
                    x2: "18",
                    y1: "20",
                    y2: "10",
                    key: "1xfpm4"
                }],
                ["line", {
                    x1: "12",
                    x2: "12",
                    y1: "20",
                    y2: "4",
                    key: "be30l9"
                }],
                ["line", {
                    x1: "6",
                    x2: "6",
                    y1: "20",
                    y2: "14",
                    key: "1r4le6"
                }]
            ])
        },
        63833: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("Copy", [
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
        70333: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("LockKeyhole", [
                ["circle", {
                    cx: "12",
                    cy: "16",
                    r: "1",
                    key: "1au0dj"
                }],
                ["rect", {
                    x: "3",
                    y: "10",
                    width: "18",
                    height: "12",
                    rx: "2",
                    key: "6s8ecr"
                }],
                ["path", {
                    d: "M7 10V7a5 5 0 0 1 10 0v3",
                    key: "1pqi11"
                }]
            ])
        },
        1228: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("Star", [
                ["polygon", {
                    points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
                    key: "8f66p6"
                }]
            ])
        },
        37866: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("TrendingDown", [
                ["polyline", {
                    points: "22 17 13.5 8.5 8.5 13.5 2 7",
                    key: "1r2t7k"
                }],
                ["polyline", {
                    points: "16 17 22 17 22 11",
                    key: "11uiuu"
                }]
            ])
        },
        81460: function(e, t, r) {
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("Users", [
                ["path", {
                    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
                    key: "1yyitq"
                }],
                ["circle", {
                    cx: "9",
                    cy: "7",
                    r: "4",
                    key: "nufk8"
                }],
                ["path", {
                    d: "M22 21v-2a4 4 0 0 0-3-3.87",
                    key: "kshegd"
                }],
                ["path", {
                    d: "M16 3.13a4 4 0 0 1 0 7.75",
                    key: "1da9ce"
                }]
            ])
        },
        66983: function(e, t, r) {
            r.d(t, {
                u: function() {
                    return n
                }
            });

            function n(e, [t, r]) {
                return Math.min(r, Math.max(t, e))
            }
        },
        84007: function(e, t, r) {
            r.d(t, {
                B: function() {
                    return u
                }
            });
            var n = r(55185),
                o = r(70358),
                l = r(46121),
                i = r(33658),
                a = r(10131);

            function u(e) {
                let t = e + "CollectionProvider",
                    [r, u] = (0, o.b)(t),
                    [c, s] = r(t, {
                        collectionRef: {
                            current: null
                        },
                        itemMap: new Map
                    }),
                    d = e => {
                        let {
                            scope: t,
                            children: r
                        } = e, o = n.useRef(null), l = n.useRef(new Map).current;
                        return (0, a.jsx)(c, {
                            scope: t,
                            itemMap: l,
                            collectionRef: o,
                            children: r
                        })
                    };
                d.displayName = t;
                let f = e + "CollectionSlot",
                    p = n.forwardRef((e, t) => {
                        let {
                            scope: r,
                            children: n
                        } = e, o = s(f, r), u = (0, l.e)(t, o.collectionRef);
                        return (0, a.jsx)(i.g7, {
                            ref: u,
                            children: n
                        })
                    });
                p.displayName = f;
                let v = e + "CollectionItemSlot",
                    h = "data-radix-collection-item",
                    w = n.forwardRef((e, t) => {
                        let {
                            scope: r,
                            children: o,
                            ...u
                        } = e, c = n.useRef(null), d = (0, l.e)(t, c), f = s(v, r);
                        return n.useEffect(() => (f.itemMap.set(c, {
                            ref: c,
                            ...u
                        }), () => void f.itemMap.delete(c))), (0, a.jsx)(i.g7, {
                            [h]: "",
                            ref: d,
                            children: o
                        })
                    });
                return w.displayName = v, [{
                    Provider: d,
                    Slot: p,
                    ItemSlot: w
                }, function(t) {
                    let r = s(e + "CollectionConsumer", t);
                    return n.useCallback(() => {
                        let e = r.collectionRef.current;
                        if (!e) return [];
                        let t = Array.from(e.querySelectorAll("[".concat(h, "]")));
                        return Array.from(r.itemMap.values()).sort((e, r) => t.indexOf(e.ref.current) - t.indexOf(r.ref.current))
                    }, [r.collectionRef, r.itemMap])
                }, u]
            }
        },
        95225: function(e, t, r) {
            r.d(t, {
                b: function() {
                    return l
                }
            });
            var n = r(55185),
                o = r(10131);

            function l(e, t = []) {
                let r = [],
                    l = () => {
                        let t = r.map(e => n.createContext(e));
                        return function(r) {
                            let o = r ? .[e] || t;
                            return n.useMemo(() => ({
                                [`__scope${e}`]: { ...r,
                                    [e]: o
                                }
                            }), [r, o])
                        }
                    };
                return l.scopeName = e, [function(t, l) {
                    let i = n.createContext(l),
                        a = r.length;
                    r = [...r, l];
                    let u = t => {
                        let {
                            scope: r,
                            children: l,
                            ...u
                        } = t, c = r ? .[e] ? .[a] || i, s = n.useMemo(() => u, Object.values(u));
                        return (0, o.jsx)(c.Provider, {
                            value: s,
                            children: l
                        })
                    };
                    return u.displayName = t + "Provider", [u, function(r, o) {
                        let u = o ? .[e] ? .[a] || i,
                            c = n.useContext(u);
                        if (c) return c;
                        if (void 0 !== l) return l;
                        throw Error(`\`${r}\` must be used within \`${t}\``)
                    }]
                }, function(...e) {
                    let t = e[0];
                    if (1 === e.length) return t;
                    let r = () => {
                        let r = e.map(e => ({
                            useScope: e(),
                            scopeName: e.scopeName
                        }));
                        return function(e) {
                            let o = r.reduce((t, {
                                useScope: r,
                                scopeName: n
                            }) => {
                                let o = r(e)[`__scope${n}`];
                                return { ...t,
                                    ...o
                                }
                            }, {});
                            return n.useMemo(() => ({
                                [`__scope${t.scopeName}`]: o
                            }), [o])
                        }
                    };
                    return r.scopeName = t.scopeName, r
                }(l, ...t)]
            }
        },
        36086: function(e, t, r) {
            r.d(t, {
                gm: function() {
                    return l
                }
            });
            var n = r(55185);
            r(10131);
            var o = n.createContext(void 0);

            function l(e) {
                let t = n.useContext(o);
                return e || t || "ltr"
            }
        },
        3215: function(e, t, r) {
            r.d(t, {
                z: function() {
                    return i
                }
            });
            var n = r(55185),
                o = r(46121),
                l = r(18680),
                i = e => {
                    var t, r;
                    let i, u;
                    let {
                        present: c,
                        children: s
                    } = e, d = function(e) {
                        var t, r;
                        let [o, i] = n.useState(), u = n.useRef({}), c = n.useRef(e), s = n.useRef("none"), [d, f] = (t = e ? "mounted" : "unmounted", r = {
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
                        }, n.useReducer((e, t) => {
                            let n = r[e][t];
                            return null != n ? n : e
                        }, t));
                        return n.useEffect(() => {
                            let e = a(u.current);
                            s.current = "mounted" === d ? e : "none"
                        }, [d]), (0, l.b)(() => {
                            let t = u.current,
                                r = c.current;
                            if (r !== e) {
                                let n = s.current,
                                    o = a(t);
                                e ? f("MOUNT") : "none" === o || (null == t ? void 0 : t.display) === "none" ? f("UNMOUNT") : r && n !== o ? f("ANIMATION_OUT") : f("UNMOUNT"), c.current = e
                            }
                        }, [e, f]), (0, l.b)(() => {
                            if (o) {
                                var e;
                                let t;
                                let r = null !== (e = o.ownerDocument.defaultView) && void 0 !== e ? e : window,
                                    n = e => {
                                        let n = a(u.current).includes(e.animationName);
                                        if (e.target === o && n && (f("ANIMATION_END"), !c.current)) {
                                            let e = o.style.animationFillMode;
                                            o.style.animationFillMode = "forwards", t = r.setTimeout(() => {
                                                "forwards" === o.style.animationFillMode && (o.style.animationFillMode = e)
                                            })
                                        }
                                    },
                                    l = e => {
                                        e.target === o && (s.current = a(u.current))
                                    };
                                return o.addEventListener("animationstart", l), o.addEventListener("animationcancel", n), o.addEventListener("animationend", n), () => {
                                    r.clearTimeout(t), o.removeEventListener("animationstart", l), o.removeEventListener("animationcancel", n), o.removeEventListener("animationend", n)
                                }
                            }
                            f("ANIMATION_END")
                        }, [o, f]), {
                            isPresent: ["mounted", "unmountSuspended"].includes(d),
                            ref: n.useCallback(e => {
                                e && (u.current = getComputedStyle(e)), i(e)
                            }, [])
                        }
                    }(c), f = "function" == typeof s ? s({
                        present: d.isPresent
                    }) : n.Children.only(s), p = (0, o.e)(d.ref, (i = null === (t = Object.getOwnPropertyDescriptor(f.props, "ref")) || void 0 === t ? void 0 : t.get) && "isReactWarning" in i && i.isReactWarning ? f.ref : (i = null === (r = Object.getOwnPropertyDescriptor(f, "ref")) || void 0 === r ? void 0 : r.get) && "isReactWarning" in i && i.isReactWarning ? f.props.ref : f.props.ref || f.ref);
                    return "function" == typeof s || d.isPresent ? n.cloneElement(f, {
                        ref: p
                    }) : null
                };

            function a(e) {
                return (null == e ? void 0 : e.animationName) || "none"
            }
            i.displayName = "Presence"
        },
        27138: function(e, t, r) {
            r.d(t, {
                Pc: function() {
                    return x
                },
                ck: function() {
                    return L
                },
                fC: function() {
                    return A
                }
            });
            var n = r(55185),
                o = r(4142),
                l = r(84007),
                i = r(46121),
                a = r(70358),
                u = r(43794),
                c = r(56366),
                s = r(51909),
                d = r(63485),
                f = r(36086),
                p = r(10131),
                v = "rovingFocusGroup.onEntryFocus",
                h = {
                    bubbles: !1,
                    cancelable: !0
                },
                w = "RovingFocusGroup",
                [m, g, y] = (0, l.B)(w),
                [b, x] = (0, a.b)(w, [y]),
                [S, E] = b(w),
                R = n.forwardRef((e, t) => (0, p.jsx)(m.Provider, {
                    scope: e.__scopeRovingFocusGroup,
                    children: (0, p.jsx)(m.Slot, {
                        scope: e.__scopeRovingFocusGroup,
                        children: (0, p.jsx)(C, { ...e,
                            ref: t
                        })
                    })
                }));
            R.displayName = w;
            var C = n.forwardRef((e, t) => {
                    let {
                        __scopeRovingFocusGroup: r,
                        orientation: l,
                        loop: a = !1,
                        dir: u,
                        currentTabStopId: w,
                        defaultCurrentTabStopId: m,
                        onCurrentTabStopIdChange: y,
                        onEntryFocus: b,
                        preventScrollOnEntryFocus: x = !1,
                        ...E
                    } = e, R = n.useRef(null), C = (0, i.e)(t, R), T = (0, f.gm)(u), [N = null, M] = (0, d.T)({
                        prop: w,
                        defaultProp: m,
                        onChange: y
                    }), [A, L] = n.useState(!1), _ = (0, s.W)(b), D = g(r), j = n.useRef(!1), [k, I] = n.useState(0);
                    return n.useEffect(() => {
                        let e = R.current;
                        if (e) return e.addEventListener(v, _), () => e.removeEventListener(v, _)
                    }, [_]), (0, p.jsx)(S, {
                        scope: r,
                        orientation: l,
                        dir: T,
                        loop: a,
                        currentTabStopId: N,
                        onItemFocus: n.useCallback(e => M(e), [M]),
                        onItemShiftTab: n.useCallback(() => L(!0), []),
                        onFocusableItemAdd: n.useCallback(() => I(e => e + 1), []),
                        onFocusableItemRemove: n.useCallback(() => I(e => e - 1), []),
                        children: (0, p.jsx)(c.WV.div, {
                            tabIndex: A || 0 === k ? -1 : 0,
                            "data-orientation": l,
                            ...E,
                            ref: C,
                            style: {
                                outline: "none",
                                ...e.style
                            },
                            onMouseDown: (0, o.M)(e.onMouseDown, () => {
                                j.current = !0
                            }),
                            onFocus: (0, o.M)(e.onFocus, e => {
                                let t = !j.current;
                                if (e.target === e.currentTarget && t && !A) {
                                    let t = new CustomEvent(v, h);
                                    if (e.currentTarget.dispatchEvent(t), !t.defaultPrevented) {
                                        let e = D().filter(e => e.focusable);
                                        P([e.find(e => e.active), e.find(e => e.id === N), ...e].filter(Boolean).map(e => e.ref.current), x)
                                    }
                                }
                                j.current = !1
                            }),
                            onBlur: (0, o.M)(e.onBlur, () => L(!1))
                        })
                    })
                }),
                T = "RovingFocusGroupItem",
                N = n.forwardRef((e, t) => {
                    let {
                        __scopeRovingFocusGroup: r,
                        focusable: l = !0,
                        active: i = !1,
                        tabStopId: a,
                        ...s
                    } = e, d = (0, u.M)(), f = a || d, v = E(T, r), h = v.currentTabStopId === f, w = g(r), {
                        onFocusableItemAdd: y,
                        onFocusableItemRemove: b
                    } = v;
                    return n.useEffect(() => {
                        if (l) return y(), () => b()
                    }, [l, y, b]), (0, p.jsx)(m.ItemSlot, {
                        scope: r,
                        id: f,
                        focusable: l,
                        active: i,
                        children: (0, p.jsx)(c.WV.span, {
                            tabIndex: h ? 0 : -1,
                            "data-orientation": v.orientation,
                            ...s,
                            ref: t,
                            onMouseDown: (0, o.M)(e.onMouseDown, e => {
                                l ? v.onItemFocus(f) : e.preventDefault()
                            }),
                            onFocus: (0, o.M)(e.onFocus, () => v.onItemFocus(f)),
                            onKeyDown: (0, o.M)(e.onKeyDown, e => {
                                if ("Tab" === e.key && e.shiftKey) {
                                    v.onItemShiftTab();
                                    return
                                }
                                if (e.target !== e.currentTarget) return;
                                let t = function(e, t, r) {
                                    var n;
                                    let o = (n = e.key, "rtl" !== r ? n : "ArrowLeft" === n ? "ArrowRight" : "ArrowRight" === n ? "ArrowLeft" : n);
                                    if (!("vertical" === t && ["ArrowLeft", "ArrowRight"].includes(o)) && !("horizontal" === t && ["ArrowUp", "ArrowDown"].includes(o))) return M[o]
                                }(e, v.orientation, v.dir);
                                if (void 0 !== t) {
                                    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
                                    e.preventDefault();
                                    let o = w().filter(e => e.focusable).map(e => e.ref.current);
                                    if ("last" === t) o.reverse();
                                    else if ("prev" === t || "next" === t) {
                                        var r, n;
                                        "prev" === t && o.reverse();
                                        let l = o.indexOf(e.currentTarget);
                                        o = v.loop ? (r = o, n = l + 1, r.map((e, t) => r[(n + t) % r.length])) : o.slice(l + 1)
                                    }
                                    setTimeout(() => P(o))
                                }
                            })
                        })
                    })
                });
            N.displayName = T;
            var M = {
                ArrowLeft: "prev",
                ArrowUp: "prev",
                ArrowRight: "next",
                ArrowDown: "next",
                PageUp: "first",
                Home: "first",
                PageDown: "last",
                End: "last"
            };

            function P(e) {
                let t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
                    r = document.activeElement;
                for (let n of e)
                    if (n === r || (n.focus({
                            preventScroll: t
                        }), document.activeElement !== r)) return
            }
            var A = R,
                L = N
        },
        92864: function(e, t, r) {
            r.d(t, {
                Ns: function() {
                    return q
                },
                fC: function() {
                    return B
                },
                gb: function() {
                    return E
                },
                l_: function() {
                    return K
                },
                q4: function() {
                    return j
                }
            });
            var n = r(55185),
                o = r(56366),
                l = r(3215),
                i = r(95225),
                a = r(46121),
                u = r(51909),
                c = r(36086),
                s = r(18680),
                d = r(66983),
                f = r(4142),
                p = r(10131),
                v = "ScrollArea",
                [h, w] = (0, i.b)(v),
                [m, g] = h(v),
                y = n.forwardRef((e, t) => {
                    let {
                        __scopeScrollArea: r,
                        type: l = "hover",
                        dir: i,
                        scrollHideDelay: u = 600,
                        ...s
                    } = e, [d, f] = n.useState(null), [v, h] = n.useState(null), [w, g] = n.useState(null), [y, b] = n.useState(null), [x, S] = n.useState(null), [E, R] = n.useState(0), [C, T] = n.useState(0), [N, M] = n.useState(!1), [P, A] = n.useState(!1), L = (0, a.e)(t, e => f(e)), _ = (0, c.gm)(i);
                    return (0, p.jsx)(m, {
                        scope: r,
                        type: l,
                        dir: _,
                        scrollHideDelay: u,
                        scrollArea: d,
                        viewport: v,
                        onViewportChange: h,
                        content: w,
                        onContentChange: g,
                        scrollbarX: y,
                        onScrollbarXChange: b,
                        scrollbarXEnabled: N,
                        onScrollbarXEnabledChange: M,
                        scrollbarY: x,
                        onScrollbarYChange: S,
                        scrollbarYEnabled: P,
                        onScrollbarYEnabledChange: A,
                        onCornerWidthChange: R,
                        onCornerHeightChange: T,
                        children: (0, p.jsx)(o.WV.div, {
                            dir: _,
                            ...s,
                            ref: L,
                            style: {
                                position: "relative",
                                "--radix-scroll-area-corner-width": E + "px",
                                "--radix-scroll-area-corner-height": C + "px",
                                ...e.style
                            }
                        })
                    })
                });
            y.displayName = v;
            var b = "ScrollAreaViewport",
                x = n.forwardRef((e, t) => {
                    let {
                        __scopeScrollArea: r,
                        children: l,
                        asChild: i,
                        nonce: u,
                        ...c
                    } = e, s = g(b, r), d = n.useRef(null), f = (0, a.e)(t, d, s.onViewportChange);
                    return (0, p.jsxs)(p.Fragment, {
                        children: [(0, p.jsx)("style", {
                            dangerouslySetInnerHTML: {
                                __html: "\n[data-radix-scroll-area-viewport] {\n  scrollbar-width: none;\n  -ms-overflow-style: none;\n  -webkit-overflow-scrolling: touch;\n}\n[data-radix-scroll-area-viewport]::-webkit-scrollbar {\n  display: none;\n}\n:where([data-radix-scroll-area-viewport]) {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n:where([data-radix-scroll-area-content]) {\n  flex-grow: 1;\n}\n"
                            },
                            nonce: u
                        }), (0, p.jsx)(o.WV.div, {
                            "data-radix-scroll-area-viewport": "",
                            ...c,
                            asChild: i,
                            ref: f,
                            style: {
                                overflowX: s.scrollbarXEnabled ? "scroll" : "hidden",
                                overflowY: s.scrollbarYEnabled ? "scroll" : "hidden",
                                ...e.style
                            },
                            children: function(e, t) {
                                let {
                                    asChild: r,
                                    children: o
                                } = e;
                                if (!r) return "function" == typeof t ? t(o) : t;
                                let l = n.Children.only(o);
                                return n.cloneElement(l, {
                                    children: "function" == typeof t ? t(l.props.children) : t
                                })
                            }({
                                asChild: i,
                                children: l
                            }, e => (0, p.jsx)("div", {
                                "data-radix-scroll-area-content": "",
                                ref: s.onContentChange,
                                style: {
                                    minWidth: s.scrollbarXEnabled ? "fit-content" : void 0
                                },
                                children: e
                            }))
                        })]
                    })
                });
            x.displayName = b;
            var S = "ScrollAreaScrollbar",
                E = n.forwardRef((e, t) => {
                    let {
                        forceMount: r,
                        ...o
                    } = e, l = g(S, e.__scopeScrollArea), {
                        onScrollbarXEnabledChange: i,
                        onScrollbarYEnabledChange: a
                    } = l, u = "horizontal" === e.orientation;
                    return n.useEffect(() => (u ? i(!0) : a(!0), () => {
                        u ? i(!1) : a(!1)
                    }), [u, i, a]), "hover" === l.type ? (0, p.jsx)(R, { ...o,
                        ref: t,
                        forceMount: r
                    }) : "scroll" === l.type ? (0, p.jsx)(C, { ...o,
                        ref: t,
                        forceMount: r
                    }) : "auto" === l.type ? (0, p.jsx)(T, { ...o,
                        ref: t,
                        forceMount: r
                    }) : "always" === l.type ? (0, p.jsx)(N, { ...o,
                        ref: t
                    }) : null
                });
            E.displayName = S;
            var R = n.forwardRef((e, t) => {
                    let {
                        forceMount: r,
                        ...o
                    } = e, i = g(S, e.__scopeScrollArea), [a, u] = n.useState(!1);
                    return n.useEffect(() => {
                        let e = i.scrollArea,
                            t = 0;
                        if (e) {
                            let r = () => {
                                    window.clearTimeout(t), u(!0)
                                },
                                n = () => {
                                    t = window.setTimeout(() => u(!1), i.scrollHideDelay)
                                };
                            return e.addEventListener("pointerenter", r), e.addEventListener("pointerleave", n), () => {
                                window.clearTimeout(t), e.removeEventListener("pointerenter", r), e.removeEventListener("pointerleave", n)
                            }
                        }
                    }, [i.scrollArea, i.scrollHideDelay]), (0, p.jsx)(l.z, {
                        present: r || a,
                        children: (0, p.jsx)(T, {
                            "data-state": a ? "visible" : "hidden",
                            ...o,
                            ref: t
                        })
                    })
                }),
                C = n.forwardRef((e, t) => {
                    var r, o;
                    let {
                        forceMount: i,
                        ...a
                    } = e, u = g(S, e.__scopeScrollArea), c = "horizontal" === e.orientation, s = Z(() => v("SCROLL_END"), 100), [d, v] = (r = "hidden", o = {
                        hidden: {
                            SCROLL: "scrolling"
                        },
                        scrolling: {
                            SCROLL_END: "idle",
                            POINTER_ENTER: "interacting"
                        },
                        interacting: {
                            SCROLL: "interacting",
                            POINTER_LEAVE: "idle"
                        },
                        idle: {
                            HIDE: "hidden",
                            SCROLL: "scrolling",
                            POINTER_ENTER: "interacting"
                        }
                    }, n.useReducer((e, t) => {
                        let r = o[e][t];
                        return null != r ? r : e
                    }, r));
                    return n.useEffect(() => {
                        if ("idle" === d) {
                            let e = window.setTimeout(() => v("HIDE"), u.scrollHideDelay);
                            return () => window.clearTimeout(e)
                        }
                    }, [d, u.scrollHideDelay, v]), n.useEffect(() => {
                        let e = u.viewport,
                            t = c ? "scrollLeft" : "scrollTop";
                        if (e) {
                            let r = e[t],
                                n = () => {
                                    let n = e[t];
                                    r !== n && (v("SCROLL"), s()), r = n
                                };
                            return e.addEventListener("scroll", n), () => e.removeEventListener("scroll", n)
                        }
                    }, [u.viewport, c, v, s]), (0, p.jsx)(l.z, {
                        present: i || "hidden" !== d,
                        children: (0, p.jsx)(N, {
                            "data-state": "hidden" === d ? "hidden" : "visible",
                            ...a,
                            ref: t,
                            onPointerEnter: (0, f.M)(e.onPointerEnter, () => v("POINTER_ENTER")),
                            onPointerLeave: (0, f.M)(e.onPointerLeave, () => v("POINTER_LEAVE"))
                        })
                    })
                }),
                T = n.forwardRef((e, t) => {
                    let r = g(S, e.__scopeScrollArea),
                        {
                            forceMount: o,
                            ...i
                        } = e,
                        [a, u] = n.useState(!1),
                        c = "horizontal" === e.orientation,
                        s = Z(() => {
                            if (r.viewport) {
                                let e = r.viewport.offsetWidth < r.viewport.scrollWidth,
                                    t = r.viewport.offsetHeight < r.viewport.scrollHeight;
                                u(c ? e : t)
                            }
                        }, 10);
                    return Y(r.viewport, s), Y(r.content, s), (0, p.jsx)(l.z, {
                        present: o || a,
                        children: (0, p.jsx)(N, {
                            "data-state": a ? "visible" : "hidden",
                            ...i,
                            ref: t
                        })
                    })
                }),
                N = n.forwardRef((e, t) => {
                    let {
                        orientation: r = "vertical",
                        ...o
                    } = e, l = g(S, e.__scopeScrollArea), i = n.useRef(null), a = n.useRef(0), [u, c] = n.useState({
                        content: 0,
                        viewport: 0,
                        scrollbar: {
                            size: 0,
                            paddingStart: 0,
                            paddingEnd: 0
                        }
                    }), s = U(u.viewport, u.content), d = { ...o,
                        sizes: u,
                        onSizesChange: c,
                        hasThumb: !!(s > 0 && s < 1),
                        onThumbChange: e => i.current = e,
                        onThumbPointerUp: () => a.current = 0,
                        onThumbPointerDown: e => a.current = e
                    };

                    function f(e, t) {
                        return function(e, t, r) {
                            let n = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "ltr",
                                o = z(r),
                                l = t || o / 2,
                                i = r.scrollbar.paddingStart + l,
                                a = r.scrollbar.size - r.scrollbar.paddingEnd - (o - l),
                                u = r.content - r.viewport;
                            return V([i, a], "ltr" === n ? [0, u] : [-1 * u, 0])(e)
                        }(e, a.current, u, t)
                    }
                    return "horizontal" === r ? (0, p.jsx)(M, { ...d,
                        ref: t,
                        onThumbPositionChange: () => {
                            if (l.viewport && i.current) {
                                let e = H(l.viewport.scrollLeft, u, l.dir);
                                i.current.style.transform = "translate3d(".concat(e, "px, 0, 0)")
                            }
                        },
                        onWheelScroll: e => {
                            l.viewport && (l.viewport.scrollLeft = e)
                        },
                        onDragScroll: e => {
                            l.viewport && (l.viewport.scrollLeft = f(e, l.dir))
                        }
                    }) : "vertical" === r ? (0, p.jsx)(P, { ...d,
                        ref: t,
                        onThumbPositionChange: () => {
                            if (l.viewport && i.current) {
                                let e = H(l.viewport.scrollTop, u);
                                i.current.style.transform = "translate3d(0, ".concat(e, "px, 0)")
                            }
                        },
                        onWheelScroll: e => {
                            l.viewport && (l.viewport.scrollTop = e)
                        },
                        onDragScroll: e => {
                            l.viewport && (l.viewport.scrollTop = f(e))
                        }
                    }) : null
                }),
                M = n.forwardRef((e, t) => {
                    let {
                        sizes: r,
                        onSizesChange: o,
                        ...l
                    } = e, i = g(S, e.__scopeScrollArea), [u, c] = n.useState(), s = n.useRef(null), d = (0, a.e)(t, s, i.onScrollbarXChange);
                    return n.useEffect(() => {
                        s.current && c(getComputedStyle(s.current))
                    }, [s]), (0, p.jsx)(_, {
                        "data-orientation": "horizontal",
                        ...l,
                        ref: d,
                        sizes: r,
                        style: {
                            bottom: 0,
                            left: "rtl" === i.dir ? "var(--radix-scroll-area-corner-width)" : 0,
                            right: "ltr" === i.dir ? "var(--radix-scroll-area-corner-width)" : 0,
                            "--radix-scroll-area-thumb-width": z(r) + "px",
                            ...e.style
                        },
                        onThumbPointerDown: t => e.onThumbPointerDown(t.x),
                        onDragScroll: t => e.onDragScroll(t.x),
                        onWheelScroll: (t, r) => {
                            if (i.viewport) {
                                let n = i.viewport.scrollLeft + t.deltaX;
                                e.onWheelScroll(n), n > 0 && n < r && t.preventDefault()
                            }
                        },
                        onResize: () => {
                            s.current && i.viewport && u && o({
                                content: i.viewport.scrollWidth,
                                viewport: i.viewport.offsetWidth,
                                scrollbar: {
                                    size: s.current.clientWidth,
                                    paddingStart: F(u.paddingLeft),
                                    paddingEnd: F(u.paddingRight)
                                }
                            })
                        }
                    })
                }),
                P = n.forwardRef((e, t) => {
                    let {
                        sizes: r,
                        onSizesChange: o,
                        ...l
                    } = e, i = g(S, e.__scopeScrollArea), [u, c] = n.useState(), s = n.useRef(null), d = (0, a.e)(t, s, i.onScrollbarYChange);
                    return n.useEffect(() => {
                        s.current && c(getComputedStyle(s.current))
                    }, [s]), (0, p.jsx)(_, {
                        "data-orientation": "vertical",
                        ...l,
                        ref: d,
                        sizes: r,
                        style: {
                            top: 0,
                            right: "ltr" === i.dir ? 0 : void 0,
                            left: "rtl" === i.dir ? 0 : void 0,
                            bottom: "var(--radix-scroll-area-corner-height)",
                            "--radix-scroll-area-thumb-height": z(r) + "px",
                            ...e.style
                        },
                        onThumbPointerDown: t => e.onThumbPointerDown(t.y),
                        onDragScroll: t => e.onDragScroll(t.y),
                        onWheelScroll: (t, r) => {
                            if (i.viewport) {
                                let n = i.viewport.scrollTop + t.deltaY;
                                e.onWheelScroll(n), n > 0 && n < r && t.preventDefault()
                            }
                        },
                        onResize: () => {
                            s.current && i.viewport && u && o({
                                content: i.viewport.scrollHeight,
                                viewport: i.viewport.offsetHeight,
                                scrollbar: {
                                    size: s.current.clientHeight,
                                    paddingStart: F(u.paddingTop),
                                    paddingEnd: F(u.paddingBottom)
                                }
                            })
                        }
                    })
                }),
                [A, L] = h(S),
                _ = n.forwardRef((e, t) => {
                    let {
                        __scopeScrollArea: r,
                        sizes: l,
                        hasThumb: i,
                        onThumbChange: c,
                        onThumbPointerUp: s,
                        onThumbPointerDown: d,
                        onThumbPositionChange: v,
                        onDragScroll: h,
                        onWheelScroll: w,
                        onResize: m,
                        ...y
                    } = e, b = g(S, r), [x, E] = n.useState(null), R = (0, a.e)(t, e => E(e)), C = n.useRef(null), T = n.useRef(""), N = b.viewport, M = l.content - l.viewport, P = (0, u.W)(w), L = (0, u.W)(v), _ = Z(m, 10);

                    function D(e) {
                        C.current && h({
                            x: e.clientX - C.current.left,
                            y: e.clientY - C.current.top
                        })
                    }
                    return n.useEffect(() => {
                        let e = e => {
                            let t = e.target;
                            (null == x ? void 0 : x.contains(t)) && P(e, M)
                        };
                        return document.addEventListener("wheel", e, {
                            passive: !1
                        }), () => document.removeEventListener("wheel", e, {
                            passive: !1
                        })
                    }, [N, x, M, P]), n.useEffect(L, [l, L]), Y(x, _), Y(b.content, _), (0, p.jsx)(A, {
                        scope: r,
                        scrollbar: x,
                        hasThumb: i,
                        onThumbChange: (0, u.W)(c),
                        onThumbPointerUp: (0, u.W)(s),
                        onThumbPositionChange: L,
                        onThumbPointerDown: (0, u.W)(d),
                        children: (0, p.jsx)(o.WV.div, { ...y,
                            ref: R,
                            style: {
                                position: "absolute",
                                ...y.style
                            },
                            onPointerDown: (0, f.M)(e.onPointerDown, e => {
                                0 === e.button && (e.target.setPointerCapture(e.pointerId), C.current = x.getBoundingClientRect(), T.current = document.body.style.webkitUserSelect, document.body.style.webkitUserSelect = "none", b.viewport && (b.viewport.style.scrollBehavior = "auto"), D(e))
                            }),
                            onPointerMove: (0, f.M)(e.onPointerMove, D),
                            onPointerUp: (0, f.M)(e.onPointerUp, e => {
                                let t = e.target;
                                t.hasPointerCapture(e.pointerId) && t.releasePointerCapture(e.pointerId), document.body.style.webkitUserSelect = T.current, b.viewport && (b.viewport.style.scrollBehavior = ""), C.current = null
                            })
                        })
                    })
                }),
                D = "ScrollAreaThumb",
                j = n.forwardRef((e, t) => {
                    let {
                        forceMount: r,
                        ...n
                    } = e, o = L(D, e.__scopeScrollArea);
                    return (0, p.jsx)(l.z, {
                        present: r || o.hasThumb,
                        children: (0, p.jsx)(k, {
                            ref: t,
                            ...n
                        })
                    })
                }),
                k = n.forwardRef((e, t) => {
                    let {
                        __scopeScrollArea: r,
                        style: l,
                        ...i
                    } = e, u = g(D, r), c = L(D, r), {
                        onThumbPositionChange: s
                    } = c, d = (0, a.e)(t, e => c.onThumbChange(e)), v = n.useRef(), h = Z(() => {
                        v.current && (v.current(), v.current = void 0)
                    }, 100);
                    return n.useEffect(() => {
                        let e = u.viewport;
                        if (e) {
                            let t = () => {
                                if (h(), !v.current) {
                                    let t = X(e, s);
                                    v.current = t, s()
                                }
                            };
                            return s(), e.addEventListener("scroll", t), () => e.removeEventListener("scroll", t)
                        }
                    }, [u.viewport, h, s]), (0, p.jsx)(o.WV.div, {
                        "data-state": c.hasThumb ? "visible" : "hidden",
                        ...i,
                        ref: d,
                        style: {
                            width: "var(--radix-scroll-area-thumb-width)",
                            height: "var(--radix-scroll-area-thumb-height)",
                            ...l
                        },
                        onPointerDownCapture: (0, f.M)(e.onPointerDownCapture, e => {
                            let t = e.target.getBoundingClientRect(),
                                r = e.clientX - t.left,
                                n = e.clientY - t.top;
                            c.onThumbPointerDown({
                                x: r,
                                y: n
                            })
                        }),
                        onPointerUp: (0, f.M)(e.onPointerUp, c.onThumbPointerUp)
                    })
                });
            j.displayName = D;
            var I = "ScrollAreaCorner",
                W = n.forwardRef((e, t) => {
                    let r = g(I, e.__scopeScrollArea),
                        n = !!(r.scrollbarX && r.scrollbarY);
                    return "scroll" !== r.type && n ? (0, p.jsx)(O, { ...e,
                        ref: t
                    }) : null
                });
            W.displayName = I;
            var O = n.forwardRef((e, t) => {
                let {
                    __scopeScrollArea: r,
                    ...l
                } = e, i = g(I, r), [a, u] = n.useState(0), [c, s] = n.useState(0), d = !!(a && c);
                return Y(i.scrollbarX, () => {
                    var e;
                    let t = (null === (e = i.scrollbarX) || void 0 === e ? void 0 : e.offsetHeight) || 0;
                    i.onCornerHeightChange(t), s(t)
                }), Y(i.scrollbarY, () => {
                    var e;
                    let t = (null === (e = i.scrollbarY) || void 0 === e ? void 0 : e.offsetWidth) || 0;
                    i.onCornerWidthChange(t), u(t)
                }), d ? (0, p.jsx)(o.WV.div, { ...l,
                    ref: t,
                    style: {
                        width: a,
                        height: c,
                        position: "absolute",
                        right: "ltr" === i.dir ? 0 : void 0,
                        left: "rtl" === i.dir ? 0 : void 0,
                        bottom: 0,
                        ...e.style
                    }
                }) : null
            });

            function F(e) {
                return e ? parseInt(e, 10) : 0
            }

            function U(e, t) {
                let r = e / t;
                return isNaN(r) ? 0 : r
            }

            function z(e) {
                let t = U(e.viewport, e.content),
                    r = e.scrollbar.paddingStart + e.scrollbar.paddingEnd;
                return Math.max((e.scrollbar.size - r) * t, 18)
            }

            function H(e, t) {
                let r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "ltr",
                    n = z(t),
                    o = t.scrollbar.paddingStart + t.scrollbar.paddingEnd,
                    l = t.scrollbar.size - o,
                    i = t.content - t.viewport,
                    a = (0, d.u)(e, "ltr" === r ? [0, i] : [-1 * i, 0]);
                return V([0, i], [0, l - n])(a)
            }

            function V(e, t) {
                return r => {
                    if (e[0] === e[1] || t[0] === t[1]) return t[0];
                    let n = (t[1] - t[0]) / (e[1] - e[0]);
                    return t[0] + n * (r - e[0])
                }
            }
            var X = function(e) {
                let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : () => {},
                    r = {
                        left: e.scrollLeft,
                        top: e.scrollTop
                    },
                    n = 0;
                return ! function o() {
                    let l = {
                            left: e.scrollLeft,
                            top: e.scrollTop
                        },
                        i = r.left !== l.left,
                        a = r.top !== l.top;
                    (i || a) && t(), r = l, n = window.requestAnimationFrame(o)
                }(), () => window.cancelAnimationFrame(n)
            };

            function Z(e, t) {
                let r = (0, u.W)(e),
                    o = n.useRef(0);
                return n.useEffect(() => () => window.clearTimeout(o.current), []), n.useCallback(() => {
                    window.clearTimeout(o.current), o.current = window.setTimeout(r, t)
                }, [r, t])
            }

            function Y(e, t) {
                let r = (0, u.W)(t);
                (0, s.b)(() => {
                    let t = 0;
                    if (e) {
                        let n = new ResizeObserver(() => {
                            cancelAnimationFrame(t), t = window.requestAnimationFrame(r)
                        });
                        return n.observe(e), () => {
                            window.cancelAnimationFrame(t), n.unobserve(e)
                        }
                    }
                }, [e, r])
            }
            var B = y,
                K = x,
                q = W
        }
    }
]);