"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [1163], {
        71163: function(e, t, n) {
            let r;
            n.d(t, {
                VY: function() {
                    return rf
                },
                ZA: function() {
                    return rv
                },
                JO: function() {
                    return rs
                },
                ck: function() {
                    return rm
                },
                wU: function() {
                    return ry
                },
                eT: function() {
                    return rg
                },
                __: function() {
                    return rh
                },
                h_: function() {
                    return rd
                },
                fC: function() {
                    return ra
                },
                $G: function() {
                    return rx
                },
                u_: function() {
                    return rw
                },
                DI: function() {
                    return nq
                },
                Z0: function() {
                    return rb
                },
                xz: function() {
                    return ru
                },
                B4: function() {
                    return rc
                },
                l_: function() {
                    return rp
                }
            });
            var o, i, l, a, u, c, s, d = n(55185),
                f = n.t(d, 2),
                p = n(19892);

            function v(e, [t, n]) {
                return Math.min(n, Math.max(t, e))
            }

            function h(e, t, {
                checkForDefaultPrevented: n = !0
            } = {}) {
                return function(r) {
                    if (e ? .(r), !1 === n || !r.defaultPrevented) return t ? .(r)
                }
            }
            "undefined" != typeof window && window.document && window.document.createElement;
            var m = n(10131);

            function g(e, t = []) {
                let n = [],
                    r = () => {
                        let t = n.map(e => d.createContext(e));
                        return function(n) {
                            let r = n ? .[e] || t;
                            return d.useMemo(() => ({
                                [`__scope${e}`]: { ...n,
                                    [e]: r
                                }
                            }), [n, r])
                        }
                    };
                return r.scopeName = e, [function(t, r) {
                    let o = d.createContext(r),
                        i = n.length;
                    n = [...n, r];
                    let l = t => {
                        let {
                            scope: n,
                            children: r,
                            ...l
                        } = t, a = n ? .[e] ? .[i] || o, u = d.useMemo(() => l, Object.values(l));
                        return (0, m.jsx)(a.Provider, {
                            value: u,
                            children: r
                        })
                    };
                    return l.displayName = t + "Provider", [l, function(n, l) {
                        let a = l ? .[e] ? .[i] || o,
                            u = d.useContext(a);
                        if (u) return u;
                        if (void 0 !== r) return r;
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
                            let r = n.reduce((t, {
                                useScope: n,
                                scopeName: r
                            }) => {
                                let o = n(e)[`__scope${r}`];
                                return { ...t,
                                    ...o
                                }
                            }, {});
                            return d.useMemo(() => ({
                                [`__scope${t.scopeName}`]: r
                            }), [r])
                        }
                    };
                    return n.scopeName = t.scopeName, n
                }(r, ...t)]
            }

            function y(e, t) {
                if ("function" == typeof e) return e(t);
                null != e && (e.current = t)
            }

            function w(...e) {
                return t => {
                    let n = !1,
                        r = e.map(e => {
                            let r = y(e, t);
                            return n || "function" != typeof r || (n = !0), r
                        });
                    if (n) return () => {
                        for (let t = 0; t < r.length; t++) {
                            let n = r[t];
                            "function" == typeof n ? n() : y(e[t], null)
                        }
                    }
                }
            }

            function x(...e) {
                return d.useCallback(w(...e), e)
            }

            function b(e) {
                let t = function(e) {
                        let t = d.forwardRef((e, t) => {
                            let {
                                children: n,
                                ...r
                            } = e;
                            if (d.isValidElement(n)) {
                                let e, o;
                                let i = (e = Object.getOwnPropertyDescriptor(n.props, "ref") ? .get) && "isReactWarning" in e && e.isReactWarning ? n.ref : (e = Object.getOwnPropertyDescriptor(n, "ref") ? .get) && "isReactWarning" in e && e.isReactWarning ? n.props.ref : n.props.ref || n.ref,
                                    l = function(e, t) {
                                        let n = { ...t
                                        };
                                        for (let r in t) {
                                            let o = e[r],
                                                i = t[r];
                                            /^on[A-Z]/.test(r) ? o && i ? n[r] = (...e) => {
                                                let t = i(...e);
                                                return o(...e), t
                                            } : o && (n[r] = o) : "style" === r ? n[r] = { ...o,
                                                ...i
                                            } : "className" === r && (n[r] = [o, i].filter(Boolean).join(" "))
                                        }
                                        return { ...e,
                                            ...n
                                        }
                                    }(r, n.props);
                                return n.type !== d.Fragment && (l.ref = t ? w(t, i) : i), d.cloneElement(n, l)
                            }
                            return d.Children.count(n) > 1 ? d.Children.only(null) : null
                        });
                        return t.displayName = `${e}.SlotClone`, t
                    }(e),
                    n = d.forwardRef((e, n) => {
                        let {
                            children: r,
                            ...o
                        } = e, i = d.Children.toArray(r), l = i.find(S);
                        if (l) {
                            let e = l.props.children,
                                r = i.map(t => t !== l ? t : d.Children.count(e) > 1 ? d.Children.only(null) : d.isValidElement(e) ? e.props.children : null);
                            return (0, m.jsx)(t, { ...o,
                                ref: n,
                                children: d.isValidElement(e) ? d.cloneElement(e, void 0, r) : null
                            })
                        }
                        return (0, m.jsx)(t, { ...o,
                            ref: n,
                            children: r
                        })
                    });
                return n.displayName = `${e}.Slot`, n
            }
            var E = Symbol("radix.slottable");

            function S(e) {
                return d.isValidElement(e) && "function" == typeof e.type && "__radixId" in e.type && e.type.__radixId === E
            }
            var C = d.createContext(void 0),
                R = ["a", "button", "div", "form", "h2", "h3", "img", "input", "label", "li", "nav", "ol", "p", "select", "span", "svg", "ul"].reduce((e, t) => {
                    let n = b(`Primitive.${t}`),
                        r = d.forwardRef((e, r) => {
                            let {
                                asChild: o,
                                ...i
                            } = e, l = o ? n : t;
                            return "undefined" != typeof window && (window[Symbol.for("radix-ui")] = !0), (0, m.jsx)(l, { ...i,
                                ref: r
                            })
                        });
                    return r.displayName = `Primitive.${t}`, { ...e,
                        [t]: r
                    }
                }, {});

            function T(e) {
                let t = d.useRef(e);
                return d.useEffect(() => {
                    t.current = e
                }), d.useMemo(() => (...e) => t.current ? .(...e), [])
            }
            var L = "dismissableLayer.update",
                P = d.createContext({
                    layers: new Set,
                    layersWithOutsidePointerEventsDisabled: new Set,
                    branches: new Set
                }),
                k = d.forwardRef((e, t) => {
                    var n, r;
                    let {
                        disableOutsidePointerEvents: o = !1,
                        onEscapeKeyDown: i,
                        onPointerDownOutside: l,
                        onFocusOutside: a,
                        onInteractOutside: u,
                        onDismiss: c,
                        ...f
                    } = e, p = d.useContext(P), [v, g] = d.useState(null), y = null !== (r = null == v ? void 0 : v.ownerDocument) && void 0 !== r ? r : null === (n = globalThis) || void 0 === n ? void 0 : n.document, [, w] = d.useState({}), b = x(t, e => g(e)), E = Array.from(p.layers), [S] = [...p.layersWithOutsidePointerEventsDisabled].slice(-1), C = E.indexOf(S), k = v ? E.indexOf(v) : -1, j = p.layersWithOutsidePointerEventsDisabled.size > 0, M = k >= C, D = function(e) {
                        var t;
                        let n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null === (t = globalThis) || void 0 === t ? void 0 : t.document,
                            r = T(e),
                            o = d.useRef(!1),
                            i = d.useRef(() => {});
                        return d.useEffect(() => {
                            let e = e => {
                                    if (e.target && !o.current) {
                                        let t = function() {
                                                N("dismissableLayer.pointerDownOutside", r, o, {
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
                                    o.current = !1
                                },
                                t = window.setTimeout(() => {
                                    n.addEventListener("pointerdown", e)
                                }, 0);
                            return () => {
                                window.clearTimeout(t), n.removeEventListener("pointerdown", e), n.removeEventListener("click", i.current)
                            }
                        }, [n, r]), {
                            onPointerDownCapture: () => o.current = !0
                        }
                    }(e => {
                        let t = e.target,
                            n = [...p.branches].some(e => e.contains(t));
                        !M || n || (null == l || l(e), null == u || u(e), e.defaultPrevented || null == c || c())
                    }, y), O = function(e) {
                        var t;
                        let n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null === (t = globalThis) || void 0 === t ? void 0 : t.document,
                            r = T(e),
                            o = d.useRef(!1);
                        return d.useEffect(() => {
                            let e = e => {
                                e.target && !o.current && N("dismissableLayer.focusOutside", r, {
                                    originalEvent: e
                                }, {
                                    discrete: !1
                                })
                            };
                            return n.addEventListener("focusin", e), () => n.removeEventListener("focusin", e)
                        }, [n, r]), {
                            onFocusCapture: () => o.current = !0,
                            onBlurCapture: () => o.current = !1
                        }
                    }(e => {
                        let t = e.target;
                        [...p.branches].some(e => e.contains(t)) || (null == a || a(e), null == u || u(e), e.defaultPrevented || null == c || c())
                    }, y);
                    return ! function(e, t = globalThis ? .document) {
                        let n = T(e);
                        d.useEffect(() => {
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
                        k !== p.layers.size - 1 || (null == i || i(e), !e.defaultPrevented && c && (e.preventDefault(), c()))
                    }, y), d.useEffect(() => {
                        if (v) return o && (0 === p.layersWithOutsidePointerEventsDisabled.size && (s = y.body.style.pointerEvents, y.body.style.pointerEvents = "none"), p.layersWithOutsidePointerEventsDisabled.add(v)), p.layers.add(v), A(), () => {
                            o && 1 === p.layersWithOutsidePointerEventsDisabled.size && (y.body.style.pointerEvents = s)
                        }
                    }, [v, y, o, p]), d.useEffect(() => () => {
                        v && (p.layers.delete(v), p.layersWithOutsidePointerEventsDisabled.delete(v), A())
                    }, [v, p]), d.useEffect(() => {
                        let e = () => w({});
                        return document.addEventListener(L, e), () => document.removeEventListener(L, e)
                    }, []), (0, m.jsx)(R.div, { ...f,
                        ref: b,
                        style: {
                            pointerEvents: j ? M ? "auto" : "none" : void 0,
                            ...e.style
                        },
                        onFocusCapture: h(e.onFocusCapture, O.onFocusCapture),
                        onBlurCapture: h(e.onBlurCapture, O.onBlurCapture),
                        onPointerDownCapture: h(e.onPointerDownCapture, D.onPointerDownCapture)
                    })
                });

            function A() {
                let e = new CustomEvent(L);
                document.dispatchEvent(e)
            }

            function N(e, t, n, r) {
                let {
                    discrete: o
                } = r, i = n.originalEvent.target, l = new CustomEvent(e, {
                    bubbles: !1,
                    cancelable: !0,
                    detail: n
                });
                (t && i.addEventListener(e, t, {
                    once: !0
                }), o) ? i && p.flushSync(() => i.dispatchEvent(l)): i.dispatchEvent(l)
            }
            k.displayName = "DismissableLayer", d.forwardRef((e, t) => {
                let n = d.useContext(P),
                    r = d.useRef(null),
                    o = x(t, r);
                return d.useEffect(() => {
                    let e = r.current;
                    if (e) return n.branches.add(e), () => {
                        n.branches.delete(e)
                    }
                }, [n.branches]), (0, m.jsx)(R.div, { ...e,
                    ref: o
                })
            }).displayName = "DismissableLayerBranch";
            var j = 0;

            function M() {
                let e = document.createElement("span");
                return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.outline = "none", e.style.opacity = "0", e.style.position = "fixed", e.style.pointerEvents = "none", e
            }
            var D = "focusScope.autoFocusOnMount",
                O = "focusScope.autoFocusOnUnmount",
                I = {
                    bubbles: !1,
                    cancelable: !0
                },
                F = d.forwardRef((e, t) => {
                    let {
                        loop: n = !1,
                        trapped: r = !1,
                        onMountAutoFocus: o,
                        onUnmountAutoFocus: i,
                        ...l
                    } = e, [a, u] = d.useState(null), c = T(o), s = T(i), f = d.useRef(null), p = x(t, e => u(e)), v = d.useRef({
                        paused: !1,
                        pause() {
                            this.paused = !0
                        },
                        resume() {
                            this.paused = !1
                        }
                    }).current;
                    d.useEffect(() => {
                        if (r) {
                            let e = function(e) {
                                    if (v.paused || !a) return;
                                    let t = e.target;
                                    a.contains(t) ? f.current = t : W(f.current, {
                                        select: !0
                                    })
                                },
                                t = function(e) {
                                    if (v.paused || !a) return;
                                    let t = e.relatedTarget;
                                    null === t || a.contains(t) || W(f.current, {
                                        select: !0
                                    })
                                };
                            document.addEventListener("focusin", e), document.addEventListener("focusout", t);
                            let n = new MutationObserver(function(e) {
                                if (document.activeElement === document.body)
                                    for (let t of e) t.removedNodes.length > 0 && W(a)
                            });
                            return a && n.observe(a, {
                                childList: !0,
                                subtree: !0
                            }), () => {
                                document.removeEventListener("focusin", e), document.removeEventListener("focusout", t), n.disconnect()
                            }
                        }
                    }, [r, a, v.paused]), d.useEffect(() => {
                        if (a) {
                            B.add(v);
                            let e = document.activeElement;
                            if (!a.contains(e)) {
                                let t = new CustomEvent(D, I);
                                a.addEventListener(D, c), a.dispatchEvent(t), t.defaultPrevented || (function(e) {
                                    let {
                                        select: t = !1
                                    } = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {}, n = document.activeElement;
                                    for (let r of e)
                                        if (W(r, {
                                                select: t
                                            }), document.activeElement !== n) return
                                }(_(a).filter(e => "A" !== e.tagName), {
                                    select: !0
                                }), document.activeElement === e && W(a))
                            }
                            return () => {
                                a.removeEventListener(D, c), setTimeout(() => {
                                    let t = new CustomEvent(O, I);
                                    a.addEventListener(O, s), a.dispatchEvent(t), t.defaultPrevented || W(null != e ? e : document.body, {
                                        select: !0
                                    }), a.removeEventListener(O, s), B.remove(v)
                                }, 0)
                            }
                        }
                    }, [a, c, s, v]);
                    let h = d.useCallback(e => {
                        if (!n && !r || v.paused) return;
                        let t = "Tab" === e.key && !e.altKey && !e.ctrlKey && !e.metaKey,
                            o = document.activeElement;
                        if (t && o) {
                            let t = e.currentTarget,
                                [r, i] = function(e) {
                                    let t = _(e);
                                    return [H(t, e), H(t.reverse(), e)]
                                }(t);
                            r && i ? e.shiftKey || o !== i ? e.shiftKey && o === r && (e.preventDefault(), n && W(i, {
                                select: !0
                            })) : (e.preventDefault(), n && W(r, {
                                select: !0
                            })) : o === t && e.preventDefault()
                        }
                    }, [n, r, v.paused]);
                    return (0, m.jsx)(R.div, {
                        tabIndex: -1,
                        ...l,
                        ref: p,
                        onKeyDown: h
                    })
                });

            function _(e) {
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

            function H(e, t) {
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

            function W(e) {
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
            F.displayName = "FocusScope";
            var B = (r = [], {
                add(e) {
                    let t = r[0];
                    e !== t && (null == t || t.pause()), (r = V(r, e)).unshift(e)
                },
                remove(e) {
                    var t;
                    null === (t = (r = V(r, e))[0]) || void 0 === t || t.resume()
                }
            });

            function V(e, t) {
                let n = [...e],
                    r = n.indexOf(t);
                return -1 !== r && n.splice(r, 1), n
            }
            var z = globalThis ? .document ? d.useLayoutEffect : () => {},
                K = f[" useId ".trim().toString()] || (() => void 0),
                $ = 0;

            function Y(e) {
                let [t, n] = d.useState(K());
                return z(() => {
                    e || n(e => e ? ? String($++))
                }, [e]), e || (t ? `radix-${t}` : "")
            }
            let X = ["top", "right", "bottom", "left"],
                U = Math.min,
                q = Math.max,
                Z = Math.round,
                G = Math.floor,
                J = e => ({
                    x: e,
                    y: e
                }),
                Q = {
                    left: "right",
                    right: "left",
                    bottom: "top",
                    top: "bottom"
                },
                ee = {
                    start: "end",
                    end: "start"
                };

            function et(e, t) {
                return "function" == typeof e ? e(t) : e
            }

            function en(e) {
                return e.split("-")[0]
            }

            function er(e) {
                return e.split("-")[1]
            }

            function eo(e) {
                return "x" === e ? "y" : "x"
            }

            function ei(e) {
                return "y" === e ? "height" : "width"
            }
            let el = new Set(["top", "bottom"]);

            function ea(e) {
                return el.has(en(e)) ? "y" : "x"
            }

            function eu(e) {
                return e.replace(/start|end/g, e => ee[e])
            }
            let ec = ["left", "right"],
                es = ["right", "left"],
                ed = ["top", "bottom"],
                ef = ["bottom", "top"];

            function ep(e) {
                return e.replace(/left|right|bottom|top/g, e => Q[e])
            }

            function ev(e) {
                return "number" != typeof e ? {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    ...e
                } : {
                    top: e,
                    right: e,
                    bottom: e,
                    left: e
                }
            }

            function eh(e) {
                let {
                    x: t,
                    y: n,
                    width: r,
                    height: o
                } = e;
                return {
                    width: r,
                    height: o,
                    top: n,
                    left: t,
                    right: t + r,
                    bottom: n + o,
                    x: t,
                    y: n
                }
            }

            function em(e, t, n) {
                let r, {
                        reference: o,
                        floating: i
                    } = e,
                    l = ea(t),
                    a = eo(ea(t)),
                    u = ei(a),
                    c = en(t),
                    s = "y" === l,
                    d = o.x + o.width / 2 - i.width / 2,
                    f = o.y + o.height / 2 - i.height / 2,
                    p = o[u] / 2 - i[u] / 2;
                switch (c) {
                    case "top":
                        r = {
                            x: d,
                            y: o.y - i.height
                        };
                        break;
                    case "bottom":
                        r = {
                            x: d,
                            y: o.y + o.height
                        };
                        break;
                    case "right":
                        r = {
                            x: o.x + o.width,
                            y: f
                        };
                        break;
                    case "left":
                        r = {
                            x: o.x - i.width,
                            y: f
                        };
                        break;
                    default:
                        r = {
                            x: o.x,
                            y: o.y
                        }
                }
                switch (er(t)) {
                    case "start":
                        r[a] -= p * (n && s ? -1 : 1);
                        break;
                    case "end":
                        r[a] += p * (n && s ? -1 : 1)
                }
                return r
            }
            let eg = async (e, t, n) => {
                let {
                    placement: r = "bottom",
                    strategy: o = "absolute",
                    middleware: i = [],
                    platform: l
                } = n, a = i.filter(Boolean), u = await (null == l.isRTL ? void 0 : l.isRTL(t)), c = await l.getElementRects({
                    reference: e,
                    floating: t,
                    strategy: o
                }), {
                    x: s,
                    y: d
                } = em(c, r, u), f = r, p = {}, v = 0;
                for (let n = 0; n < a.length; n++) {
                    let {
                        name: i,
                        fn: h
                    } = a[n], {
                        x: m,
                        y: g,
                        data: y,
                        reset: w
                    } = await h({
                        x: s,
                        y: d,
                        initialPlacement: r,
                        placement: f,
                        strategy: o,
                        middlewareData: p,
                        rects: c,
                        platform: l,
                        elements: {
                            reference: e,
                            floating: t
                        }
                    });
                    s = null != m ? m : s, d = null != g ? g : d, p = { ...p,
                        [i]: { ...p[i],
                            ...y
                        }
                    }, w && v <= 50 && (v++, "object" == typeof w && (w.placement && (f = w.placement), w.rects && (c = !0 === w.rects ? await l.getElementRects({
                        reference: e,
                        floating: t,
                        strategy: o
                    }) : w.rects), {
                        x: s,
                        y: d
                    } = em(c, f, u)), n = -1)
                }
                return {
                    x: s,
                    y: d,
                    placement: f,
                    strategy: o,
                    middlewareData: p
                }
            };
            async function ey(e, t) {
                var n;
                void 0 === t && (t = {});
                let {
                    x: r,
                    y: o,
                    platform: i,
                    rects: l,
                    elements: a,
                    strategy: u
                } = e, {
                    boundary: c = "clippingAncestors",
                    rootBoundary: s = "viewport",
                    elementContext: d = "floating",
                    altBoundary: f = !1,
                    padding: p = 0
                } = et(t, e), v = ev(p), h = a[f ? "floating" === d ? "reference" : "floating" : d], m = eh(await i.getClippingRect({
                    element: null == (n = await (null == i.isElement ? void 0 : i.isElement(h))) || n ? h : h.contextElement || await (null == i.getDocumentElement ? void 0 : i.getDocumentElement(a.floating)),
                    boundary: c,
                    rootBoundary: s,
                    strategy: u
                })), g = "floating" === d ? {
                    x: r,
                    y: o,
                    width: l.floating.width,
                    height: l.floating.height
                } : l.reference, y = await (null == i.getOffsetParent ? void 0 : i.getOffsetParent(a.floating)), w = await (null == i.isElement ? void 0 : i.isElement(y)) && await (null == i.getScale ? void 0 : i.getScale(y)) || {
                    x: 1,
                    y: 1
                }, x = eh(i.convertOffsetParentRelativeRectToViewportRelativeRect ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
                    elements: a,
                    rect: g,
                    offsetParent: y,
                    strategy: u
                }) : g);
                return {
                    top: (m.top - x.top + v.top) / w.y,
                    bottom: (x.bottom - m.bottom + v.bottom) / w.y,
                    left: (m.left - x.left + v.left) / w.x,
                    right: (x.right - m.right + v.right) / w.x
                }
            }

            function ew(e, t) {
                return {
                    top: e.top - t.height,
                    right: e.right - t.width,
                    bottom: e.bottom - t.height,
                    left: e.left - t.width
                }
            }

            function ex(e) {
                return X.some(t => e[t] >= 0)
            }
            let eb = new Set(["left", "top"]);
            async function eE(e, t) {
                let {
                    placement: n,
                    platform: r,
                    elements: o
                } = e, i = await (null == r.isRTL ? void 0 : r.isRTL(o.floating)), l = en(n), a = er(n), u = "y" === ea(n), c = eb.has(l) ? -1 : 1, s = i && u ? -1 : 1, d = et(t, e), {
                    mainAxis: f,
                    crossAxis: p,
                    alignmentAxis: v
                } = "number" == typeof d ? {
                    mainAxis: d,
                    crossAxis: 0,
                    alignmentAxis: null
                } : {
                    mainAxis: d.mainAxis || 0,
                    crossAxis: d.crossAxis || 0,
                    alignmentAxis: d.alignmentAxis
                };
                return a && "number" == typeof v && (p = "end" === a ? -1 * v : v), u ? {
                    x: p * s,
                    y: f * c
                } : {
                    x: f * c,
                    y: p * s
                }
            }

            function eS() {
                return "undefined" != typeof window
            }

            function eC(e) {
                return eL(e) ? (e.nodeName || "").toLowerCase() : "#document"
            }

            function eR(e) {
                var t;
                return (null == e || null == (t = e.ownerDocument) ? void 0 : t.defaultView) || window
            }

            function eT(e) {
                var t;
                return null == (t = (eL(e) ? e.ownerDocument : e.document) || window.document) ? void 0 : t.documentElement
            }

            function eL(e) {
                return !!eS() && (e instanceof Node || e instanceof eR(e).Node)
            }

            function eP(e) {
                return !!eS() && (e instanceof Element || e instanceof eR(e).Element)
            }

            function ek(e) {
                return !!eS() && (e instanceof HTMLElement || e instanceof eR(e).HTMLElement)
            }

            function eA(e) {
                return !!eS() && "undefined" != typeof ShadowRoot && (e instanceof ShadowRoot || e instanceof eR(e).ShadowRoot)
            }
            let eN = new Set(["inline", "contents"]);

            function ej(e) {
                let {
                    overflow: t,
                    overflowX: n,
                    overflowY: r,
                    display: o
                } = ez(e);
                return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && !eN.has(o)
            }
            let eM = new Set(["table", "td", "th"]),
                eD = [":popover-open", ":modal"];

            function eO(e) {
                return eD.some(t => {
                    try {
                        return e.matches(t)
                    } catch (e) {
                        return !1
                    }
                })
            }
            let eI = ["transform", "translate", "scale", "rotate", "perspective"],
                eF = ["transform", "translate", "scale", "rotate", "perspective", "filter"],
                e_ = ["paint", "layout", "strict", "content"];

            function eH(e) {
                let t = eW(),
                    n = eP(e) ? ez(e) : e;
                return eI.some(e => !!n[e] && "none" !== n[e]) || !!n.containerType && "normal" !== n.containerType || !t && !!n.backdropFilter && "none" !== n.backdropFilter || !t && !!n.filter && "none" !== n.filter || eF.some(e => (n.willChange || "").includes(e)) || e_.some(e => (n.contain || "").includes(e))
            }

            function eW() {
                return "undefined" != typeof CSS && !!CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")
            }
            let eB = new Set(["html", "body", "#document"]);

            function eV(e) {
                return eB.has(eC(e))
            }

            function ez(e) {
                return eR(e).getComputedStyle(e)
            }

            function eK(e) {
                return eP(e) ? {
                    scrollLeft: e.scrollLeft,
                    scrollTop: e.scrollTop
                } : {
                    scrollLeft: e.scrollX,
                    scrollTop: e.scrollY
                }
            }

            function e$(e) {
                if ("html" === eC(e)) return e;
                let t = e.assignedSlot || e.parentNode || eA(e) && e.host || eT(e);
                return eA(t) ? t.host : t
            }

            function eY(e, t, n) {
                var r;
                void 0 === t && (t = []), void 0 === n && (n = !0);
                let o = function e(t) {
                        let n = e$(t);
                        return eV(n) ? t.ownerDocument ? t.ownerDocument.body : t.body : ek(n) && ej(n) ? n : e(n)
                    }(e),
                    i = o === (null == (r = e.ownerDocument) ? void 0 : r.body),
                    l = eR(o);
                if (i) {
                    let e = eX(l);
                    return t.concat(l, l.visualViewport || [], ej(o) ? o : [], e && n ? eY(e) : [])
                }
                return t.concat(o, eY(o, [], n))
            }

            function eX(e) {
                return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null
            }

            function eU(e) {
                let t = ez(e),
                    n = parseFloat(t.width) || 0,
                    r = parseFloat(t.height) || 0,
                    o = ek(e),
                    i = o ? e.offsetWidth : n,
                    l = o ? e.offsetHeight : r,
                    a = Z(n) !== i || Z(r) !== l;
                return a && (n = i, r = l), {
                    width: n,
                    height: r,
                    $: a
                }
            }

            function eq(e) {
                return eP(e) ? e : e.contextElement
            }

            function eZ(e) {
                let t = eq(e);
                if (!ek(t)) return J(1);
                let n = t.getBoundingClientRect(),
                    {
                        width: r,
                        height: o,
                        $: i
                    } = eU(t),
                    l = (i ? Z(n.width) : n.width) / r,
                    a = (i ? Z(n.height) : n.height) / o;
                return l && Number.isFinite(l) || (l = 1), a && Number.isFinite(a) || (a = 1), {
                    x: l,
                    y: a
                }
            }
            let eG = J(0);

            function eJ(e) {
                let t = eR(e);
                return eW() && t.visualViewport ? {
                    x: t.visualViewport.offsetLeft,
                    y: t.visualViewport.offsetTop
                } : eG
            }

            function eQ(e, t, n, r) {
                var o;
                void 0 === t && (t = !1), void 0 === n && (n = !1);
                let i = e.getBoundingClientRect(),
                    l = eq(e),
                    a = J(1);
                t && (r ? eP(r) && (a = eZ(r)) : a = eZ(e));
                let u = (void 0 === (o = n) && (o = !1), r && (!o || r === eR(l)) && o) ? eJ(l) : J(0),
                    c = (i.left + u.x) / a.x,
                    s = (i.top + u.y) / a.y,
                    d = i.width / a.x,
                    f = i.height / a.y;
                if (l) {
                    let e = eR(l),
                        t = r && eP(r) ? eR(r) : r,
                        n = e,
                        o = eX(n);
                    for (; o && r && t !== n;) {
                        let e = eZ(o),
                            t = o.getBoundingClientRect(),
                            r = ez(o),
                            i = t.left + (o.clientLeft + parseFloat(r.paddingLeft)) * e.x,
                            l = t.top + (o.clientTop + parseFloat(r.paddingTop)) * e.y;
                        c *= e.x, s *= e.y, d *= e.x, f *= e.y, c += i, s += l, o = eX(n = eR(o))
                    }
                }
                return eh({
                    width: d,
                    height: f,
                    x: c,
                    y: s
                })
            }

            function e0(e, t) {
                let n = eK(e).scrollLeft;
                return t ? t.left + n : eQ(eT(e)).left + n
            }

            function e1(e, t) {
                let n = e.getBoundingClientRect();
                return {
                    x: n.left + t.scrollLeft - e0(e, n),
                    y: n.top + t.scrollTop
                }
            }
            let e2 = new Set(["absolute", "fixed"]);

            function e5(e, t, n) {
                let r;
                if ("viewport" === t) r = function(e, t) {
                    let n = eR(e),
                        r = eT(e),
                        o = n.visualViewport,
                        i = r.clientWidth,
                        l = r.clientHeight,
                        a = 0,
                        u = 0;
                    if (o) {
                        i = o.width, l = o.height;
                        let e = eW();
                        (!e || e && "fixed" === t) && (a = o.offsetLeft, u = o.offsetTop)
                    }
                    let c = e0(r);
                    if (c <= 0) {
                        let e = r.ownerDocument,
                            t = e.body,
                            n = getComputedStyle(t),
                            o = "CSS1Compat" === e.compatMode && parseFloat(n.marginLeft) + parseFloat(n.marginRight) || 0,
                            l = Math.abs(r.clientWidth - t.clientWidth - o);
                        l <= 25 && (i -= l)
                    } else c <= 25 && (i += c);
                    return {
                        width: i,
                        height: l,
                        x: a,
                        y: u
                    }
                }(e, n);
                else if ("document" === t) r = function(e) {
                    let t = eT(e),
                        n = eK(e),
                        r = e.ownerDocument.body,
                        o = q(t.scrollWidth, t.clientWidth, r.scrollWidth, r.clientWidth),
                        i = q(t.scrollHeight, t.clientHeight, r.scrollHeight, r.clientHeight),
                        l = -n.scrollLeft + e0(e),
                        a = -n.scrollTop;
                    return "rtl" === ez(r).direction && (l += q(t.clientWidth, r.clientWidth) - o), {
                        width: o,
                        height: i,
                        x: l,
                        y: a
                    }
                }(eT(e));
                else if (eP(t)) r = function(e, t) {
                    let n = eQ(e, !0, "fixed" === t),
                        r = n.top + e.clientTop,
                        o = n.left + e.clientLeft,
                        i = ek(e) ? eZ(e) : J(1),
                        l = e.clientWidth * i.x;
                    return {
                        width: l,
                        height: e.clientHeight * i.y,
                        x: o * i.x,
                        y: r * i.y
                    }
                }(t, n);
                else {
                    let n = eJ(e);
                    r = {
                        x: t.x - n.x,
                        y: t.y - n.y,
                        width: t.width,
                        height: t.height
                    }
                }
                return eh(r)
            }

            function e3(e) {
                return "static" === ez(e).position
            }

            function e6(e, t) {
                if (!ek(e) || "fixed" === ez(e).position) return null;
                if (t) return t(e);
                let n = e.offsetParent;
                return eT(e) === n && (n = n.ownerDocument.body), n
            }

            function e8(e, t) {
                var n;
                let r = eR(e);
                if (eO(e)) return r;
                if (!ek(e)) {
                    let t = e$(e);
                    for (; t && !eV(t);) {
                        if (eP(t) && !e3(t)) return t;
                        t = e$(t)
                    }
                    return r
                }
                let o = e6(e, t);
                for (; o && (n = o, eM.has(eC(n))) && e3(o);) o = e6(o, t);
                return o && eV(o) && e3(o) && !eH(o) ? r : o || function(e) {
                    let t = e$(e);
                    for (; ek(t) && !eV(t);) {
                        if (eH(t)) return t;
                        if (eO(t)) break;
                        t = e$(t)
                    }
                    return null
                }(e) || r
            }
            let e4 = async function(e) {
                    let t = this.getOffsetParent || e8,
                        n = this.getDimensions,
                        r = await n(e.floating);
                    return {
                        reference: function(e, t, n) {
                            let r = ek(t),
                                o = eT(t),
                                i = "fixed" === n,
                                l = eQ(e, !0, i, t),
                                a = {
                                    scrollLeft: 0,
                                    scrollTop: 0
                                },
                                u = J(0);
                            if (r || !r && !i) {
                                if (("body" !== eC(t) || ej(o)) && (a = eK(t)), r) {
                                    let e = eQ(t, !0, i, t);
                                    u.x = e.x + t.clientLeft, u.y = e.y + t.clientTop
                                } else o && (u.x = e0(o))
                            }
                            i && !r && o && (u.x = e0(o));
                            let c = !o || r || i ? J(0) : e1(o, a);
                            return {
                                x: l.left + a.scrollLeft - u.x - c.x,
                                y: l.top + a.scrollTop - u.y - c.y,
                                width: l.width,
                                height: l.height
                            }
                        }(e.reference, await t(e.floating), e.strategy),
                        floating: {
                            x: 0,
                            y: 0,
                            width: r.width,
                            height: r.height
                        }
                    }
                },
                e7 = {
                    convertOffsetParentRelativeRectToViewportRelativeRect: function(e) {
                        let {
                            elements: t,
                            rect: n,
                            offsetParent: r,
                            strategy: o
                        } = e, i = "fixed" === o, l = eT(r), a = !!t && eO(t.floating);
                        if (r === l || a && i) return n;
                        let u = {
                                scrollLeft: 0,
                                scrollTop: 0
                            },
                            c = J(1),
                            s = J(0),
                            d = ek(r);
                        if ((d || !d && !i) && (("body" !== eC(r) || ej(l)) && (u = eK(r)), ek(r))) {
                            let e = eQ(r);
                            c = eZ(r), s.x = e.x + r.clientLeft, s.y = e.y + r.clientTop
                        }
                        let f = !l || d || i ? J(0) : e1(l, u);
                        return {
                            width: n.width * c.x,
                            height: n.height * c.y,
                            x: n.x * c.x - u.scrollLeft * c.x + s.x + f.x,
                            y: n.y * c.y - u.scrollTop * c.y + s.y + f.y
                        }
                    },
                    getDocumentElement: eT,
                    getClippingRect: function(e) {
                        let {
                            element: t,
                            boundary: n,
                            rootBoundary: r,
                            strategy: o
                        } = e, i = [..."clippingAncestors" === n ? eO(t) ? [] : function(e, t) {
                            let n = t.get(e);
                            if (n) return n;
                            let r = eY(e, [], !1).filter(e => eP(e) && "body" !== eC(e)),
                                o = null,
                                i = "fixed" === ez(e).position,
                                l = i ? e$(e) : e;
                            for (; eP(l) && !eV(l);) {
                                let t = ez(l),
                                    n = eH(l);
                                n || "fixed" !== t.position || (o = null), (i ? !n && !o : !n && "static" === t.position && !!o && e2.has(o.position) || ej(l) && !n && function e(t, n) {
                                    let r = e$(t);
                                    return !(r === n || !eP(r) || eV(r)) && ("fixed" === ez(r).position || e(r, n))
                                }(e, l)) ? r = r.filter(e => e !== l) : o = t, l = e$(l)
                            }
                            return t.set(e, r), r
                        }(t, this._c) : [].concat(n), r], l = i[0], a = i.reduce((e, n) => {
                            let r = e5(t, n, o);
                            return e.top = q(r.top, e.top), e.right = U(r.right, e.right), e.bottom = U(r.bottom, e.bottom), e.left = q(r.left, e.left), e
                        }, e5(t, l, o));
                        return {
                            width: a.right - a.left,
                            height: a.bottom - a.top,
                            x: a.left,
                            y: a.top
                        }
                    },
                    getOffsetParent: e8,
                    getElementRects: e4,
                    getClientRects: function(e) {
                        return Array.from(e.getClientRects())
                    },
                    getDimensions: function(e) {
                        let {
                            width: t,
                            height: n
                        } = eU(e);
                        return {
                            width: t,
                            height: n
                        }
                    },
                    getScale: eZ,
                    isElement: eP,
                    isRTL: function(e) {
                        return "rtl" === ez(e).direction
                    }
                };

            function e9(e, t) {
                return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height
            }
            let te = e => ({
                    name: "arrow",
                    options: e,
                    async fn(t) {
                        let {
                            x: n,
                            y: r,
                            placement: o,
                            rects: i,
                            platform: l,
                            elements: a,
                            middlewareData: u
                        } = t, {
                            element: c,
                            padding: s = 0
                        } = et(e, t) || {};
                        if (null == c) return {};
                        let d = ev(s),
                            f = {
                                x: n,
                                y: r
                            },
                            p = eo(ea(o)),
                            v = ei(p),
                            h = await l.getDimensions(c),
                            m = "y" === p,
                            g = m ? "clientHeight" : "clientWidth",
                            y = i.reference[v] + i.reference[p] - f[p] - i.floating[v],
                            w = f[p] - i.reference[p],
                            x = await (null == l.getOffsetParent ? void 0 : l.getOffsetParent(c)),
                            b = x ? x[g] : 0;
                        b && await (null == l.isElement ? void 0 : l.isElement(x)) || (b = a.floating[g] || i.floating[v]);
                        let E = b / 2 - h[v] / 2 - 1,
                            S = U(d[m ? "top" : "left"], E),
                            C = U(d[m ? "bottom" : "right"], E),
                            R = b - h[v] - C,
                            T = b / 2 - h[v] / 2 + (y / 2 - w / 2),
                            L = q(S, U(T, R)),
                            P = !u.arrow && null != er(o) && T !== L && i.reference[v] / 2 - (T < S ? S : C) - h[v] / 2 < 0,
                            k = P ? T < S ? T - S : T - R : 0;
                        return {
                            [p]: f[p] + k,
                            data: {
                                [p]: L,
                                centerOffset: T - L - k,
                                ...P && {
                                    alignmentOffset: k
                                }
                            },
                            reset: P
                        }
                    }
                }),
                tt = (e, t, n) => {
                    let r = new Map,
                        o = {
                            platform: e7,
                            ...n
                        },
                        i = { ...o.platform,
                            _c: r
                        };
                    return eg(e, t, { ...o,
                        platform: i
                    })
                };
            var tn = "undefined" != typeof document ? d.useLayoutEffect : function() {};

            function tr(e, t) {
                let n, r, o;
                if (e === t) return !0;
                if (typeof e != typeof t) return !1;
                if ("function" == typeof e && e.toString() === t.toString()) return !0;
                if (e && t && "object" == typeof e) {
                    if (Array.isArray(e)) {
                        if ((n = e.length) !== t.length) return !1;
                        for (r = n; 0 != r--;)
                            if (!tr(e[r], t[r])) return !1;
                        return !0
                    }
                    if ((n = (o = Object.keys(e)).length) !== Object.keys(t).length) return !1;
                    for (r = n; 0 != r--;)
                        if (!({}).hasOwnProperty.call(t, o[r])) return !1;
                    for (r = n; 0 != r--;) {
                        let n = o[r];
                        if (("_owner" !== n || !e.$$typeof) && !tr(e[n], t[n])) return !1
                    }
                    return !0
                }
                return e != e && t != t
            }

            function to(e) {
                return "undefined" == typeof window ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1
            }

            function ti(e, t) {
                let n = to(e);
                return Math.round(t * n) / n
            }

            function tl(e) {
                let t = d.useRef(e);
                return tn(() => {
                    t.current = e
                }), t
            }
            let ta = e => ({
                    name: "arrow",
                    options: e,
                    fn(t) {
                        let {
                            element: n,
                            padding: r
                        } = "function" == typeof e ? e(t) : e;
                        return n && ({}).hasOwnProperty.call(n, "current") ? null != n.current ? te({
                            element: n.current,
                            padding: r
                        }).fn(t) : {} : n ? te({
                            element: n,
                            padding: r
                        }).fn(t) : {}
                    }
                }),
                tu = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = 0), {
                            name: "offset",
                            options: n,
                            async fn(e) {
                                var t, r;
                                let {
                                    x: o,
                                    y: i,
                                    placement: l,
                                    middlewareData: a
                                } = e, u = await eE(e, n);
                                return l === (null == (t = a.offset) ? void 0 : t.placement) && null != (r = a.arrow) && r.alignmentOffset ? {} : {
                                    x: o + u.x,
                                    y: i + u.y,
                                    data: { ...u,
                                        placement: l
                                    }
                                }
                            }
                        }),
                        options: [e, t]
                    }
                },
                tc = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = {}), {
                            name: "shift",
                            options: n,
                            async fn(e) {
                                let {
                                    x: t,
                                    y: r,
                                    placement: o
                                } = e, {
                                    mainAxis: i = !0,
                                    crossAxis: l = !1,
                                    limiter: a = {
                                        fn: e => {
                                            let {
                                                x: t,
                                                y: n
                                            } = e;
                                            return {
                                                x: t,
                                                y: n
                                            }
                                        }
                                    },
                                    ...u
                                } = et(n, e), c = {
                                    x: t,
                                    y: r
                                }, s = await ey(e, u), d = ea(en(o)), f = eo(d), p = c[f], v = c[d];
                                if (i) {
                                    let e = "y" === f ? "top" : "left",
                                        t = "y" === f ? "bottom" : "right",
                                        n = p + s[e],
                                        r = p - s[t];
                                    p = q(n, U(p, r))
                                }
                                if (l) {
                                    let e = "y" === d ? "top" : "left",
                                        t = "y" === d ? "bottom" : "right",
                                        n = v + s[e],
                                        r = v - s[t];
                                    v = q(n, U(v, r))
                                }
                                let h = a.fn({ ...e,
                                    [f]: p,
                                    [d]: v
                                });
                                return { ...h,
                                    data: {
                                        x: h.x - t,
                                        y: h.y - r,
                                        enabled: {
                                            [f]: i,
                                            [d]: l
                                        }
                                    }
                                }
                            }
                        }),
                        options: [e, t]
                    }
                },
                ts = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = {}), {
                            options: n,
                            fn(e) {
                                let {
                                    x: t,
                                    y: r,
                                    placement: o,
                                    rects: i,
                                    middlewareData: l
                                } = e, {
                                    offset: a = 0,
                                    mainAxis: u = !0,
                                    crossAxis: c = !0
                                } = et(n, e), s = {
                                    x: t,
                                    y: r
                                }, d = ea(o), f = eo(d), p = s[f], v = s[d], h = et(a, e), m = "number" == typeof h ? {
                                    mainAxis: h,
                                    crossAxis: 0
                                } : {
                                    mainAxis: 0,
                                    crossAxis: 0,
                                    ...h
                                };
                                if (u) {
                                    let e = "y" === f ? "height" : "width",
                                        t = i.reference[f] - i.floating[e] + m.mainAxis,
                                        n = i.reference[f] + i.reference[e] - m.mainAxis;
                                    p < t ? p = t : p > n && (p = n)
                                }
                                if (c) {
                                    var g, y;
                                    let e = "y" === f ? "width" : "height",
                                        t = eb.has(en(o)),
                                        n = i.reference[d] - i.floating[e] + (t && (null == (g = l.offset) ? void 0 : g[d]) || 0) + (t ? 0 : m.crossAxis),
                                        r = i.reference[d] + i.reference[e] + (t ? 0 : (null == (y = l.offset) ? void 0 : y[d]) || 0) - (t ? m.crossAxis : 0);
                                    v < n ? v = n : v > r && (v = r)
                                }
                                return {
                                    [f]: p,
                                    [d]: v
                                }
                            }
                        }),
                        options: [e, t]
                    }
                },
                td = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = {}), {
                            name: "flip",
                            options: n,
                            async fn(e) {
                                var t, r, o, i, l;
                                let {
                                    placement: a,
                                    middlewareData: u,
                                    rects: c,
                                    initialPlacement: s,
                                    platform: d,
                                    elements: f
                                } = e, {
                                    mainAxis: p = !0,
                                    crossAxis: v = !0,
                                    fallbackPlacements: h,
                                    fallbackStrategy: m = "bestFit",
                                    fallbackAxisSideDirection: g = "none",
                                    flipAlignment: y = !0,
                                    ...w
                                } = et(n, e);
                                if (null != (t = u.arrow) && t.alignmentOffset) return {};
                                let x = en(a),
                                    b = ea(s),
                                    E = en(s) === s,
                                    S = await (null == d.isRTL ? void 0 : d.isRTL(f.floating)),
                                    C = h || (E || !y ? [ep(s)] : function(e) {
                                        let t = ep(e);
                                        return [eu(e), t, eu(t)]
                                    }(s)),
                                    R = "none" !== g;
                                !h && R && C.push(... function(e, t, n, r) {
                                    let o = er(e),
                                        i = function(e, t, n) {
                                            switch (e) {
                                                case "top":
                                                case "bottom":
                                                    if (n) return t ? es : ec;
                                                    return t ? ec : es;
                                                case "left":
                                                case "right":
                                                    return t ? ed : ef;
                                                default:
                                                    return []
                                            }
                                        }(en(e), "start" === n, r);
                                    return o && (i = i.map(e => e + "-" + o), t && (i = i.concat(i.map(eu)))), i
                                }(s, y, g, S));
                                let T = [s, ...C],
                                    L = await ey(e, w),
                                    P = [],
                                    k = (null == (r = u.flip) ? void 0 : r.overflows) || [];
                                if (p && P.push(L[x]), v) {
                                    let e = function(e, t, n) {
                                        void 0 === n && (n = !1);
                                        let r = er(e),
                                            o = eo(ea(e)),
                                            i = ei(o),
                                            l = "x" === o ? r === (n ? "end" : "start") ? "right" : "left" : "start" === r ? "bottom" : "top";
                                        return t.reference[i] > t.floating[i] && (l = ep(l)), [l, ep(l)]
                                    }(a, c, S);
                                    P.push(L[e[0]], L[e[1]])
                                }
                                if (k = [...k, {
                                        placement: a,
                                        overflows: P
                                    }], !P.every(e => e <= 0)) {
                                    let e = ((null == (o = u.flip) ? void 0 : o.index) || 0) + 1,
                                        t = T[e];
                                    if (t && (!("alignment" === v && b !== ea(t)) || k.every(e => ea(e.placement) !== b || e.overflows[0] > 0))) return {
                                        data: {
                                            index: e,
                                            overflows: k
                                        },
                                        reset: {
                                            placement: t
                                        }
                                    };
                                    let n = null == (i = k.filter(e => e.overflows[0] <= 0).sort((e, t) => e.overflows[1] - t.overflows[1])[0]) ? void 0 : i.placement;
                                    if (!n) switch (m) {
                                        case "bestFit":
                                            {
                                                let e = null == (l = k.filter(e => {
                                                    if (R) {
                                                        let t = ea(e.placement);
                                                        return t === b || "y" === t
                                                    }
                                                    return !0
                                                }).map(e => [e.placement, e.overflows.filter(e => e > 0).reduce((e, t) => e + t, 0)]).sort((e, t) => e[1] - t[1])[0]) ? void 0 : l[0];e && (n = e);
                                                break
                                            }
                                        case "initialPlacement":
                                            n = s
                                    }
                                    if (a !== n) return {
                                        reset: {
                                            placement: n
                                        }
                                    }
                                }
                                return {}
                            }
                        }),
                        options: [e, t]
                    }
                },
                tf = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = {}), {
                            name: "size",
                            options: n,
                            async fn(e) {
                                var t, r;
                                let o, i;
                                let {
                                    placement: l,
                                    rects: a,
                                    platform: u,
                                    elements: c
                                } = e, {
                                    apply: s = () => {},
                                    ...d
                                } = et(n, e), f = await ey(e, d), p = en(l), v = er(l), h = "y" === ea(l), {
                                    width: m,
                                    height: g
                                } = a.floating;
                                "top" === p || "bottom" === p ? (o = p, i = v === (await (null == u.isRTL ? void 0 : u.isRTL(c.floating)) ? "start" : "end") ? "left" : "right") : (i = p, o = "end" === v ? "top" : "bottom");
                                let y = g - f.top - f.bottom,
                                    w = m - f.left - f.right,
                                    x = U(g - f[o], y),
                                    b = U(m - f[i], w),
                                    E = !e.middlewareData.shift,
                                    S = x,
                                    C = b;
                                if (null != (t = e.middlewareData.shift) && t.enabled.x && (C = w), null != (r = e.middlewareData.shift) && r.enabled.y && (S = y), E && !v) {
                                    let e = q(f.left, 0),
                                        t = q(f.right, 0),
                                        n = q(f.top, 0),
                                        r = q(f.bottom, 0);
                                    h ? C = m - 2 * (0 !== e || 0 !== t ? e + t : q(f.left, f.right)) : S = g - 2 * (0 !== n || 0 !== r ? n + r : q(f.top, f.bottom))
                                }
                                await s({ ...e,
                                    availableWidth: C,
                                    availableHeight: S
                                });
                                let R = await u.getDimensions(c.floating);
                                return m !== R.width || g !== R.height ? {
                                    reset: {
                                        rects: !0
                                    }
                                } : {}
                            }
                        }),
                        options: [e, t]
                    }
                },
                tp = (e, t) => {
                    var n;
                    return { ...(void 0 === (n = e) && (n = {}), {
                            name: "hide",
                            options: n,
                            async fn(e) {
                                let {
                                    rects: t
                                } = e, {
                                    strategy: r = "referenceHidden",
                                    ...o
                                } = et(n, e);
                                switch (r) {
                                    case "referenceHidden":
                                        {
                                            let n = ew(await ey(e, { ...o,
                                                elementContext: "reference"
                                            }), t.reference);
                                            return {
                                                data: {
                                                    referenceHiddenOffsets: n,
                                                    referenceHidden: ex(n)
                                                }
                                            }
                                        }
                                    case "escaped":
                                        {
                                            let n = ew(await ey(e, { ...o,
                                                altBoundary: !0
                                            }), t.floating);
                                            return {
                                                data: {
                                                    escapedOffsets: n,
                                                    escaped: ex(n)
                                                }
                                            }
                                        }
                                    default:
                                        return {}
                                }
                            }
                        }),
                        options: [e, t]
                    }
                },
                tv = (e, t) => ({ ...ta(e),
                    options: [e, t]
                });
            var th = d.forwardRef((e, t) => {
                let {
                    children: n,
                    width: r = 10,
                    height: o = 5,
                    ...i
                } = e;
                return (0, m.jsx)(R.svg, { ...i,
                    ref: t,
                    width: r,
                    height: o,
                    viewBox: "0 0 30 10",
                    preserveAspectRatio: "none",
                    children: e.asChild ? n : (0, m.jsx)("polygon", {
                        points: "0,0 30,0 15,10"
                    })
                })
            });
            th.displayName = "Arrow";
            var tm = "Popper",
                [tg, ty] = g(tm),
                [tw, tx] = tg(tm),
                tb = e => {
                    let {
                        __scopePopper: t,
                        children: n
                    } = e, [r, o] = d.useState(null);
                    return (0, m.jsx)(tw, {
                        scope: t,
                        anchor: r,
                        onAnchorChange: o,
                        children: n
                    })
                };
            tb.displayName = tm;
            var tE = "PopperAnchor",
                tS = d.forwardRef((e, t) => {
                    let {
                        __scopePopper: n,
                        virtualRef: r,
                        ...o
                    } = e, i = tx(tE, n), l = d.useRef(null), a = x(t, l), u = d.useRef(null);
                    return d.useEffect(() => {
                        let e = u.current;
                        u.current = (null == r ? void 0 : r.current) || l.current, e !== u.current && i.onAnchorChange(u.current)
                    }), r ? null : (0, m.jsx)(R.div, { ...o,
                        ref: a
                    })
                });
            tS.displayName = tE;
            var tC = "PopperContent",
                [tR, tT] = tg(tC),
                tL = d.forwardRef((e, t) => {
                    var n, r, o, i, l, a, u, c;
                    let {
                        __scopePopper: s,
                        side: f = "bottom",
                        sideOffset: v = 0,
                        align: h = "center",
                        alignOffset: g = 0,
                        arrowPadding: y = 0,
                        avoidCollisions: w = !0,
                        collisionBoundary: b = [],
                        collisionPadding: E = 0,
                        sticky: S = "partial",
                        hideWhenDetached: C = !1,
                        updatePositionStrategy: L = "optimized",
                        onPlaced: P,
                        ...k
                    } = e, A = tx(tC, s), [N, j] = d.useState(null), M = x(t, e => j(e)), [D, O] = d.useState(null), I = function(e) {
                        let [t, n] = d.useState(void 0);
                        return z(() => {
                            if (e) {
                                n({
                                    width: e.offsetWidth,
                                    height: e.offsetHeight
                                });
                                let t = new ResizeObserver(t => {
                                    let r, o;
                                    if (!Array.isArray(t) || !t.length) return;
                                    let i = t[0];
                                    if ("borderBoxSize" in i) {
                                        let e = i.borderBoxSize,
                                            t = Array.isArray(e) ? e[0] : e;
                                        r = t.inlineSize, o = t.blockSize
                                    } else r = e.offsetWidth, o = e.offsetHeight;
                                    n({
                                        width: r,
                                        height: o
                                    })
                                });
                                return t.observe(e, {
                                    box: "border-box"
                                }), () => t.unobserve(e)
                            }
                            n(void 0)
                        }, [e]), t
                    }(D), F = null !== (u = null == I ? void 0 : I.width) && void 0 !== u ? u : 0, _ = null !== (c = null == I ? void 0 : I.height) && void 0 !== c ? c : 0, H = "number" == typeof E ? E : {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        ...E
                    }, W = Array.isArray(b) ? b : [b], B = W.length > 0, V = {
                        padding: H,
                        boundary: W.filter(tN),
                        altBoundary: B
                    }, {
                        refs: K,
                        floatingStyles: $,
                        placement: Y,
                        isPositioned: X,
                        middlewareData: Z
                    } = function(e) {
                        void 0 === e && (e = {});
                        let {
                            placement: t = "bottom",
                            strategy: n = "absolute",
                            middleware: r = [],
                            platform: o,
                            elements: {
                                reference: i,
                                floating: l
                            } = {},
                            transform: a = !0,
                            whileElementsMounted: u,
                            open: c
                        } = e, [s, f] = d.useState({
                            x: 0,
                            y: 0,
                            strategy: n,
                            placement: t,
                            middlewareData: {},
                            isPositioned: !1
                        }), [v, h] = d.useState(r);
                        tr(v, r) || h(r);
                        let [m, g] = d.useState(null), [y, w] = d.useState(null), x = d.useCallback(e => {
                            e !== C.current && (C.current = e, g(e))
                        }, []), b = d.useCallback(e => {
                            e !== R.current && (R.current = e, w(e))
                        }, []), E = i || m, S = l || y, C = d.useRef(null), R = d.useRef(null), T = d.useRef(s), L = null != u, P = tl(u), k = tl(o), A = tl(c), N = d.useCallback(() => {
                            if (!C.current || !R.current) return;
                            let e = {
                                placement: t,
                                strategy: n,
                                middleware: v
                            };
                            k.current && (e.platform = k.current), tt(C.current, R.current, e).then(e => {
                                let t = { ...e,
                                    isPositioned: !1 !== A.current
                                };
                                j.current && !tr(T.current, t) && (T.current = t, p.flushSync(() => {
                                    f(t)
                                }))
                            })
                        }, [v, t, n, k, A]);
                        tn(() => {
                            !1 === c && T.current.isPositioned && (T.current.isPositioned = !1, f(e => ({ ...e,
                                isPositioned: !1
                            })))
                        }, [c]);
                        let j = d.useRef(!1);
                        tn(() => (j.current = !0, () => {
                            j.current = !1
                        }), []), tn(() => {
                            if (E && (C.current = E), S && (R.current = S), E && S) {
                                if (P.current) return P.current(E, S, N);
                                N()
                            }
                        }, [E, S, N, P, L]);
                        let M = d.useMemo(() => ({
                                reference: C,
                                floating: R,
                                setReference: x,
                                setFloating: b
                            }), [x, b]),
                            D = d.useMemo(() => ({
                                reference: E,
                                floating: S
                            }), [E, S]),
                            O = d.useMemo(() => {
                                let e = {
                                    position: n,
                                    left: 0,
                                    top: 0
                                };
                                if (!D.floating) return e;
                                let t = ti(D.floating, s.x),
                                    r = ti(D.floating, s.y);
                                return a ? { ...e,
                                    transform: "translate(" + t + "px, " + r + "px)",
                                    ...to(D.floating) >= 1.5 && {
                                        willChange: "transform"
                                    }
                                } : {
                                    position: n,
                                    left: t,
                                    top: r
                                }
                            }, [n, a, D.floating, s.x, s.y]);
                        return d.useMemo(() => ({ ...s,
                            update: N,
                            refs: M,
                            elements: D,
                            floatingStyles: O
                        }), [s, N, M, D, O])
                    }({
                        strategy: "fixed",
                        placement: f + ("center" !== h ? "-" + h : ""),
                        whileElementsMounted: function() {
                            for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n];
                            return function(e, t, n, r) {
                                let o;
                                void 0 === r && (r = {});
                                let {
                                    ancestorScroll: i = !0,
                                    ancestorResize: l = !0,
                                    elementResize: a = "function" == typeof ResizeObserver,
                                    layoutShift: u = "function" == typeof IntersectionObserver,
                                    animationFrame: c = !1
                                } = r, s = eq(e), d = i || l ? [...s ? eY(s) : [], ...eY(t)] : [];
                                d.forEach(e => {
                                    i && e.addEventListener("scroll", n, {
                                        passive: !0
                                    }), l && e.addEventListener("resize", n)
                                });
                                let f = s && u ? function(e, t) {
                                        let n, r = null,
                                            o = eT(e);

                                        function i() {
                                            var e;
                                            clearTimeout(n), null == (e = r) || e.disconnect(), r = null
                                        }
                                        return ! function l(a, u) {
                                            void 0 === a && (a = !1), void 0 === u && (u = 1), i();
                                            let c = e.getBoundingClientRect(),
                                                {
                                                    left: s,
                                                    top: d,
                                                    width: f,
                                                    height: p
                                                } = c;
                                            if (a || t(), !f || !p) return;
                                            let v = G(d),
                                                h = G(o.clientWidth - (s + f)),
                                                m = {
                                                    rootMargin: -v + "px " + -h + "px " + -G(o.clientHeight - (d + p)) + "px " + -G(s) + "px",
                                                    threshold: q(0, U(1, u)) || 1
                                                },
                                                g = !0;

                                            function y(t) {
                                                let r = t[0].intersectionRatio;
                                                if (r !== u) {
                                                    if (!g) return l();
                                                    r ? l(!1, r) : n = setTimeout(() => {
                                                        l(!1, 1e-7)
                                                    }, 1e3)
                                                }
                                                1 !== r || e9(c, e.getBoundingClientRect()) || l(), g = !1
                                            }
                                            try {
                                                r = new IntersectionObserver(y, { ...m,
                                                    root: o.ownerDocument
                                                })
                                            } catch (e) {
                                                r = new IntersectionObserver(y, m)
                                            }
                                            r.observe(e)
                                        }(!0), i
                                    }(s, n) : null,
                                    p = -1,
                                    v = null;
                                a && (v = new ResizeObserver(e => {
                                    let [r] = e;
                                    r && r.target === s && v && (v.unobserve(t), cancelAnimationFrame(p), p = requestAnimationFrame(() => {
                                        var e;
                                        null == (e = v) || e.observe(t)
                                    })), n()
                                }), s && !c && v.observe(s), v.observe(t));
                                let h = c ? eQ(e) : null;
                                return c && function t() {
                                    let r = eQ(e);
                                    h && !e9(h, r) && n(), h = r, o = requestAnimationFrame(t)
                                }(), n(), () => {
                                    var e;
                                    d.forEach(e => {
                                        i && e.removeEventListener("scroll", n), l && e.removeEventListener("resize", n)
                                    }), null == f || f(), null == (e = v) || e.disconnect(), v = null, c && cancelAnimationFrame(o)
                                }
                            }(...t, {
                                animationFrame: "always" === L
                            })
                        },
                        elements: {
                            reference: A.anchor
                        },
                        middleware: [tu({
                            mainAxis: v + _,
                            alignmentAxis: g
                        }), w && tc({
                            mainAxis: !0,
                            crossAxis: !1,
                            limiter: "partial" === S ? ts() : void 0,
                            ...V
                        }), w && td({ ...V
                        }), tf({ ...V,
                            apply: e => {
                                let {
                                    elements: t,
                                    rects: n,
                                    availableWidth: r,
                                    availableHeight: o
                                } = e, {
                                    width: i,
                                    height: l
                                } = n.reference, a = t.floating.style;
                                a.setProperty("--radix-popper-available-width", "".concat(r, "px")), a.setProperty("--radix-popper-available-height", "".concat(o, "px")), a.setProperty("--radix-popper-anchor-width", "".concat(i, "px")), a.setProperty("--radix-popper-anchor-height", "".concat(l, "px"))
                            }
                        }), D && tv({
                            element: D,
                            padding: y
                        }), tj({
                            arrowWidth: F,
                            arrowHeight: _
                        }), C && tp({
                            strategy: "referenceHidden",
                            ...V
                        })]
                    }), [J, Q] = tM(Y), ee = T(P);
                    z(() => {
                        X && (null == ee || ee())
                    }, [X, ee]);
                    let et = null === (n = Z.arrow) || void 0 === n ? void 0 : n.x,
                        en = null === (r = Z.arrow) || void 0 === r ? void 0 : r.y,
                        er = (null === (o = Z.arrow) || void 0 === o ? void 0 : o.centerOffset) !== 0,
                        [eo, ei] = d.useState();
                    return z(() => {
                        N && ei(window.getComputedStyle(N).zIndex)
                    }, [N]), (0, m.jsx)("div", {
                        ref: K.setFloating,
                        "data-radix-popper-content-wrapper": "",
                        style: { ...$,
                            transform: X ? $.transform : "translate(0, -200%)",
                            minWidth: "max-content",
                            zIndex: eo,
                            "--radix-popper-transform-origin": [null === (i = Z.transformOrigin) || void 0 === i ? void 0 : i.x, null === (l = Z.transformOrigin) || void 0 === l ? void 0 : l.y].join(" "),
                            ...(null === (a = Z.hide) || void 0 === a ? void 0 : a.referenceHidden) && {
                                visibility: "hidden",
                                pointerEvents: "none"
                            }
                        },
                        dir: e.dir,
                        children: (0, m.jsx)(tR, {
                            scope: s,
                            placedSide: J,
                            onArrowChange: O,
                            arrowX: et,
                            arrowY: en,
                            shouldHideArrow: er,
                            children: (0, m.jsx)(R.div, {
                                "data-side": J,
                                "data-align": Q,
                                ...k,
                                ref: M,
                                style: { ...k.style,
                                    animation: X ? void 0 : "none"
                                }
                            })
                        })
                    })
                });
            tL.displayName = tC;
            var tP = "PopperArrow",
                tk = {
                    top: "bottom",
                    right: "left",
                    bottom: "top",
                    left: "right"
                },
                tA = d.forwardRef(function(e, t) {
                    let {
                        __scopePopper: n,
                        ...r
                    } = e, o = tT(tP, n), i = tk[o.placedSide];
                    return (0, m.jsx)("span", {
                        ref: o.onArrowChange,
                        style: {
                            position: "absolute",
                            left: o.arrowX,
                            top: o.arrowY,
                            [i]: 0,
                            transformOrigin: {
                                top: "",
                                right: "0 0",
                                bottom: "center 0",
                                left: "100% 0"
                            }[o.placedSide],
                            transform: {
                                top: "translateY(100%)",
                                right: "translateY(50%) rotate(90deg) translateX(-50%)",
                                bottom: "rotate(180deg)",
                                left: "translateY(50%) rotate(-90deg) translateX(50%)"
                            }[o.placedSide],
                            visibility: o.shouldHideArrow ? "hidden" : void 0
                        },
                        children: (0, m.jsx)(th, { ...r,
                            ref: t,
                            style: { ...r.style,
                                display: "block"
                            }
                        })
                    })
                });

            function tN(e) {
                return null !== e
            }
            tA.displayName = tP;
            var tj = e => ({
                name: "transformOrigin",
                options: e,
                fn(t) {
                    var n, r, o, i, l;
                    let {
                        placement: a,
                        rects: u,
                        middlewareData: c
                    } = t, s = (null === (n = c.arrow) || void 0 === n ? void 0 : n.centerOffset) !== 0, d = s ? 0 : e.arrowWidth, f = s ? 0 : e.arrowHeight, [p, v] = tM(a), h = {
                        start: "0%",
                        center: "50%",
                        end: "100%"
                    }[v], m = (null !== (i = null === (r = c.arrow) || void 0 === r ? void 0 : r.x) && void 0 !== i ? i : 0) + d / 2, g = (null !== (l = null === (o = c.arrow) || void 0 === o ? void 0 : o.y) && void 0 !== l ? l : 0) + f / 2, y = "", w = "";
                    return "bottom" === p ? (y = s ? h : "".concat(m, "px"), w = "".concat(-f, "px")) : "top" === p ? (y = s ? h : "".concat(m, "px"), w = "".concat(u.floating.height + f, "px")) : "right" === p ? (y = "".concat(-f, "px"), w = s ? h : "".concat(g, "px")) : "left" === p && (y = "".concat(u.floating.width + f, "px"), w = s ? h : "".concat(g, "px")), {
                        data: {
                            x: y,
                            y: w
                        }
                    }
                }
            });

            function tM(e) {
                let [t, n = "center"] = e.split("-");
                return [t, n]
            }
            var tD = d.forwardRef((e, t) => {
                var n, r;
                let {
                    container: o,
                    ...i
                } = e, [l, a] = d.useState(!1);
                z(() => a(!0), []);
                let u = o || l && (null === (r = globalThis) || void 0 === r ? void 0 : null === (n = r.document) || void 0 === n ? void 0 : n.body);
                return u ? p.createPortal((0, m.jsx)(R.div, { ...i,
                    ref: t
                }), u) : null
            });
            tD.displayName = "Portal";
            var tO = f[" useInsertionEffect ".trim().toString()] || z;

            function tI({
                prop: e,
                defaultProp: t,
                onChange: n = () => {},
                caller: r
            }) {
                let [o, i, l] = function({
                    defaultProp: e,
                    onChange: t
                }) {
                    let [n, r] = d.useState(e), o = d.useRef(n), i = d.useRef(t);
                    return tO(() => {
                        i.current = t
                    }, [t]), d.useEffect(() => {
                        o.current !== n && (i.current ? .(n), o.current = n)
                    }, [n, o]), [n, r, i]
                }({
                    defaultProp: t,
                    onChange: n
                }), a = void 0 !== e, u = a ? e : o; {
                    let t = d.useRef(void 0 !== e);
                    d.useEffect(() => {
                        let e = t.current;
                        if (e !== a) {
                            let t = a ? "controlled" : "uncontrolled";
                            console.warn(`${r} is changing from ${e?"controlled":"uncontrolled"} to ${t}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`)
                        }
                        t.current = a
                    }, [a, r])
                }
                return [u, d.useCallback(t => {
                    if (a) {
                        let n = "function" == typeof t ? t(e) : t;
                        n !== e && l.current ? .(n)
                    } else i(t)
                }, [a, e, i, l])]
            }
            Symbol("RADIX:SYNC_STATE");
            var tF = Object.freeze({
                position: "absolute",
                border: 0,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                wordWrap: "normal"
            });
            d.forwardRef((e, t) => (0, m.jsx)(R.span, { ...e,
                ref: t,
                style: { ...tF,
                    ...e.style
                }
            })).displayName = "VisuallyHidden";
            var t_ = n(34467),
                tH = n(37826),
                tW = "right-scroll-bar-position",
                tB = "width-before-scroll-bar";

            function tV(e, t) {
                return "function" == typeof e ? e(t) : e && (e.current = t), e
            }
            var tz = "undefined" != typeof window ? d.useLayoutEffect : d.useEffect,
                tK = new WeakMap,
                t$ = (void 0 === o && (o = {}), (void 0 === i && (i = function(e) {
                    return e
                }), l = [], a = !1, u = {
                    read: function() {
                        if (a) throw Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
                        return l.length ? l[l.length - 1] : null
                    },
                    useMedium: function(e) {
                        var t = i(e, a);
                        return l.push(t),
                            function() {
                                l = l.filter(function(e) {
                                    return e !== t
                                })
                            }
                    },
                    assignSyncMedium: function(e) {
                        for (a = !0; l.length;) {
                            var t = l;
                            l = [], t.forEach(e)
                        }
                        l = {
                            push: function(t) {
                                return e(t)
                            },
                            filter: function() {
                                return l
                            }
                        }
                    },
                    assignMedium: function(e) {
                        a = !0;
                        var t = [];
                        if (l.length) {
                            var n = l;
                            l = [], n.forEach(e), t = l
                        }
                        var r = function() {
                                var n = t;
                                t = [], n.forEach(e)
                            },
                            o = function() {
                                return Promise.resolve().then(r)
                            };
                        o(), l = {
                            push: function(e) {
                                t.push(e), o()
                            },
                            filter: function(e) {
                                return t = t.filter(e), l
                            }
                        }
                    }
                }).options = (0, tH.pi)({
                    async: !0,
                    ssr: !1
                }, o), u),
                tY = function() {},
                tX = d.forwardRef(function(e, t) {
                    var n, r, o, i, l = d.useRef(null),
                        a = d.useState({
                            onScrollCapture: tY,
                            onWheelCapture: tY,
                            onTouchMoveCapture: tY
                        }),
                        u = a[0],
                        c = a[1],
                        s = e.forwardProps,
                        f = e.children,
                        p = e.className,
                        v = e.removeScrollBar,
                        h = e.enabled,
                        m = e.shards,
                        g = e.sideCar,
                        y = e.noRelative,
                        w = e.noIsolation,
                        x = e.inert,
                        b = e.allowPinchZoom,
                        E = e.as,
                        S = e.gapMode,
                        C = (0, tH._T)(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]),
                        R = (n = [l, t], r = function(e) {
                            return n.forEach(function(t) {
                                return tV(t, e)
                            })
                        }, (o = (0, d.useState)(function() {
                            return {
                                value: null,
                                callback: r,
                                facade: {
                                    get current() {
                                        return o.value
                                    },
                                    set current(value) {
                                        var e = o.value;
                                        e !== value && (o.value = value, o.callback(value, e))
                                    }
                                }
                            }
                        })[0]).callback = r, i = o.facade, tz(function() {
                            var e = tK.get(i);
                            if (e) {
                                var t = new Set(e),
                                    r = new Set(n),
                                    o = i.current;
                                t.forEach(function(e) {
                                    r.has(e) || tV(e, null)
                                }), r.forEach(function(e) {
                                    t.has(e) || tV(e, o)
                                })
                            }
                            tK.set(i, n)
                        }, [n]), i),
                        T = (0, tH.pi)((0, tH.pi)({}, C), u);
                    return d.createElement(d.Fragment, null, h && d.createElement(g, {
                        sideCar: t$,
                        removeScrollBar: v,
                        shards: m,
                        noRelative: y,
                        noIsolation: w,
                        inert: x,
                        setCallbacks: c,
                        allowPinchZoom: !!b,
                        lockRef: l,
                        gapMode: S
                    }), s ? d.cloneElement(d.Children.only(f), (0, tH.pi)((0, tH.pi)({}, T), {
                        ref: R
                    })) : d.createElement(void 0 === E ? "div" : E, (0, tH.pi)({}, T, {
                        className: p,
                        ref: R
                    }), f))
                });
            tX.defaultProps = {
                enabled: !0,
                removeScrollBar: !0,
                inert: !1
            }, tX.classNames = {
                fullWidth: tB,
                zeroRight: tW
            };
            var tU = function(e) {
                var t = e.sideCar,
                    n = (0, tH._T)(e, ["sideCar"]);
                if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
                var r = t.read();
                if (!r) throw Error("Sidecar medium not found");
                return d.createElement(r, (0, tH.pi)({}, n))
            };
            tU.isSideCarExport = !0;
            var tq = n(84062),
                tZ = function() {
                    var e = 0,
                        t = null;
                    return {
                        add: function(n) {
                            if (0 == e && (t = function() {
                                    if (!document) return null;
                                    var e = document.createElement("style");
                                    e.type = "text/css";
                                    var t = (0, tq.V)();
                                    return t && e.setAttribute("nonce", t), e
                                }())) {
                                var r, o;
                                (r = t).styleSheet ? r.styleSheet.cssText = n : r.appendChild(document.createTextNode(n)), o = t, (document.head || document.getElementsByTagName("head")[0]).appendChild(o)
                            }
                            e++
                        },
                        remove: function() {
                            --e || !t || (t.parentNode && t.parentNode.removeChild(t), t = null)
                        }
                    }
                },
                tG = function() {
                    var e = tZ();
                    return function(t, n) {
                        d.useEffect(function() {
                            return e.add(t),
                                function() {
                                    e.remove()
                                }
                        }, [t && n])
                    }
                },
                tJ = function() {
                    var e = tG();
                    return function(t) {
                        return e(t.styles, t.dynamic), null
                    }
                },
                tQ = {
                    left: 0,
                    top: 0,
                    right: 0,
                    gap: 0
                },
                t0 = function(e) {
                    return parseInt(e || "", 10) || 0
                },
                t1 = function(e) {
                    var t = window.getComputedStyle(document.body),
                        n = t["padding" === e ? "paddingLeft" : "marginLeft"],
                        r = t["padding" === e ? "paddingTop" : "marginTop"],
                        o = t["padding" === e ? "paddingRight" : "marginRight"];
                    return [t0(n), t0(r), t0(o)]
                },
                t2 = function(e) {
                    if (void 0 === e && (e = "margin"), "undefined" == typeof window) return tQ;
                    var t = t1(e),
                        n = document.documentElement.clientWidth,
                        r = window.innerWidth;
                    return {
                        left: t[0],
                        top: t[1],
                        right: t[2],
                        gap: Math.max(0, r - n + t[2] - t[0])
                    }
                },
                t5 = tJ(),
                t3 = "data-scroll-locked",
                t6 = function(e, t, n, r) {
                    var o = e.left,
                        i = e.top,
                        l = e.right,
                        a = e.gap;
                    return void 0 === n && (n = "margin"), "\n  .".concat("with-scroll-bars-hidden", " {\n   overflow: hidden ").concat(r, ";\n   padding-right: ").concat(a, "px ").concat(r, ";\n  }\n  body[").concat(t3, "] {\n    overflow: hidden ").concat(r, ";\n    overscroll-behavior: contain;\n    ").concat([t && "position: relative ".concat(r, ";"), "margin" === n && "\n    padding-left: ".concat(o, "px;\n    padding-top: ").concat(i, "px;\n    padding-right: ").concat(l, "px;\n    margin-left:0;\n    margin-top:0;\n    margin-right: ").concat(a, "px ").concat(r, ";\n    "), "padding" === n && "padding-right: ".concat(a, "px ").concat(r, ";")].filter(Boolean).join(""), "\n  }\n  \n  .").concat(tW, " {\n    right: ").concat(a, "px ").concat(r, ";\n  }\n  \n  .").concat(tB, " {\n    margin-right: ").concat(a, "px ").concat(r, ";\n  }\n  \n  .").concat(tW, " .").concat(tW, " {\n    right: 0 ").concat(r, ";\n  }\n  \n  .").concat(tB, " .").concat(tB, " {\n    margin-right: 0 ").concat(r, ";\n  }\n  \n  body[").concat(t3, "] {\n    ").concat("--removed-body-scroll-bar-size", ": ").concat(a, "px;\n  }\n")
                },
                t8 = function() {
                    var e = parseInt(document.body.getAttribute(t3) || "0", 10);
                    return isFinite(e) ? e : 0
                },
                t4 = function() {
                    d.useEffect(function() {
                        return document.body.setAttribute(t3, (t8() + 1).toString()),
                            function() {
                                var e = t8() - 1;
                                e <= 0 ? document.body.removeAttribute(t3) : document.body.setAttribute(t3, e.toString())
                            }
                    }, [])
                },
                t7 = function(e) {
                    var t = e.noRelative,
                        n = e.noImportant,
                        r = e.gapMode,
                        o = void 0 === r ? "margin" : r;
                    t4();
                    var i = d.useMemo(function() {
                        return t2(o)
                    }, [o]);
                    return d.createElement(t5, {
                        styles: t6(i, !t, o, n ? "" : "!important")
                    })
                },
                t9 = !1;
            if ("undefined" != typeof window) try {
                var ne = Object.defineProperty({}, "passive", {
                    get: function() {
                        return t9 = !0, !0
                    }
                });
                window.addEventListener("test", ne, ne), window.removeEventListener("test", ne, ne)
            } catch (e) {
                t9 = !1
            }
            var nt = !!t9 && {
                    passive: !1
                },
                nn = function(e, t) {
                    if (!(e instanceof Element)) return !1;
                    var n = window.getComputedStyle(e);
                    return "hidden" !== n[t] && !(n.overflowY === n.overflowX && "TEXTAREA" !== e.tagName && "visible" === n[t])
                },
                nr = function(e, t) {
                    var n = t.ownerDocument,
                        r = t;
                    do {
                        if ("undefined" != typeof ShadowRoot && r instanceof ShadowRoot && (r = r.host), no(e, r)) {
                            var o = ni(e, r);
                            if (o[1] > o[2]) return !0
                        }
                        r = r.parentNode
                    } while (r && r !== n.body);
                    return !1
                },
                no = function(e, t) {
                    return "v" === e ? nn(t, "overflowY") : nn(t, "overflowX")
                },
                ni = function(e, t) {
                    return "v" === e ? [t.scrollTop, t.scrollHeight, t.clientHeight] : [t.scrollLeft, t.scrollWidth, t.clientWidth]
                },
                nl = function(e, t, n, r, o) {
                    var i, l = (i = window.getComputedStyle(t).direction, "h" === e && "rtl" === i ? -1 : 1),
                        a = l * r,
                        u = n.target,
                        c = t.contains(u),
                        s = !1,
                        d = a > 0,
                        f = 0,
                        p = 0;
                    do {
                        if (!u) break;
                        var v = ni(e, u),
                            h = v[0],
                            m = v[1] - v[2] - l * h;
                        (h || m) && no(e, u) && (f += m, p += h);
                        var g = u.parentNode;
                        u = g && g.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? g.host : g
                    } while (!c && u !== document.body || c && (t.contains(u) || t === u));
                    return d && (o && 1 > Math.abs(f) || !o && a > f) ? s = !0 : !d && (o && 1 > Math.abs(p) || !o && -a > p) && (s = !0), s
                },
                na = function(e) {
                    return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0]
                },
                nu = function(e) {
                    return [e.deltaX, e.deltaY]
                },
                nc = function(e) {
                    return e && "current" in e ? e.current : e
                },
                ns = 0,
                nd = [],
                nf = (c = function(e) {
                    var t = d.useRef([]),
                        n = d.useRef([0, 0]),
                        r = d.useRef(),
                        o = d.useState(ns++)[0],
                        i = d.useState(tJ)[0],
                        l = d.useRef(e);
                    d.useEffect(function() {
                        l.current = e
                    }, [e]), d.useEffect(function() {
                        if (e.inert) {
                            document.body.classList.add("block-interactivity-".concat(o));
                            var t = (0, tH.ev)([e.lockRef.current], (e.shards || []).map(nc), !0).filter(Boolean);
                            return t.forEach(function(e) {
                                    return e.classList.add("allow-interactivity-".concat(o))
                                }),
                                function() {
                                    document.body.classList.remove("block-interactivity-".concat(o)), t.forEach(function(e) {
                                        return e.classList.remove("allow-interactivity-".concat(o))
                                    })
                                }
                        }
                    }, [e.inert, e.lockRef.current, e.shards]);
                    var a = d.useCallback(function(e, t) {
                            if ("touches" in e && 2 === e.touches.length || "wheel" === e.type && e.ctrlKey) return !l.current.allowPinchZoom;
                            var o, i = na(e),
                                a = n.current,
                                u = "deltaX" in e ? e.deltaX : a[0] - i[0],
                                c = "deltaY" in e ? e.deltaY : a[1] - i[1],
                                s = e.target,
                                d = Math.abs(u) > Math.abs(c) ? "h" : "v";
                            if ("touches" in e && "h" === d && "range" === s.type) return !1;
                            var f = window.getSelection(),
                                p = f && f.anchorNode;
                            if (p && (p === s || p.contains(s))) return !1;
                            var v = nr(d, s);
                            if (!v) return !0;
                            if (v ? o = d : (o = "v" === d ? "h" : "v", v = nr(d, s)), !v) return !1;
                            if (!r.current && "changedTouches" in e && (u || c) && (r.current = o), !o) return !0;
                            var h = r.current || o;
                            return nl(h, t, e, "h" === h ? u : c, !0)
                        }, []),
                        u = d.useCallback(function(e) {
                            if (nd.length && nd[nd.length - 1] === i) {
                                var n = "deltaY" in e ? nu(e) : na(e),
                                    r = t.current.filter(function(t) {
                                        var r;
                                        return t.name === e.type && (t.target === e.target || e.target === t.shadowParent) && (r = t.delta)[0] === n[0] && r[1] === n[1]
                                    })[0];
                                if (r && r.should) {
                                    e.cancelable && e.preventDefault();
                                    return
                                }
                                if (!r) {
                                    var o = (l.current.shards || []).map(nc).filter(Boolean).filter(function(t) {
                                        return t.contains(e.target)
                                    });
                                    (o.length > 0 ? a(e, o[0]) : !l.current.noIsolation) && e.cancelable && e.preventDefault()
                                }
                            }
                        }, []),
                        c = d.useCallback(function(e, n, r, o) {
                            var i = {
                                name: e,
                                delta: n,
                                target: r,
                                should: o,
                                shadowParent: function(e) {
                                    for (var t = null; null !== e;) e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
                                    return t
                                }(r)
                            };
                            t.current.push(i), setTimeout(function() {
                                t.current = t.current.filter(function(e) {
                                    return e !== i
                                })
                            }, 1)
                        }, []),
                        s = d.useCallback(function(e) {
                            n.current = na(e), r.current = void 0
                        }, []),
                        f = d.useCallback(function(t) {
                            c(t.type, nu(t), t.target, a(t, e.lockRef.current))
                        }, []),
                        p = d.useCallback(function(t) {
                            c(t.type, na(t), t.target, a(t, e.lockRef.current))
                        }, []);
                    d.useEffect(function() {
                        return nd.push(i), e.setCallbacks({
                                onScrollCapture: f,
                                onWheelCapture: f,
                                onTouchMoveCapture: p
                            }), document.addEventListener("wheel", u, nt), document.addEventListener("touchmove", u, nt), document.addEventListener("touchstart", s, nt),
                            function() {
                                nd = nd.filter(function(e) {
                                    return e !== i
                                }), document.removeEventListener("wheel", u, nt), document.removeEventListener("touchmove", u, nt), document.removeEventListener("touchstart", s, nt)
                            }
                    }, []);
                    var v = e.removeScrollBar,
                        h = e.inert;
                    return d.createElement(d.Fragment, null, h ? d.createElement(i, {
                        styles: "\n  .block-interactivity-".concat(o, " {pointer-events: none;}\n  .allow-interactivity-").concat(o, " {pointer-events: all;}\n")
                    }) : null, v ? d.createElement(t7, {
                        noRelative: e.noRelative,
                        gapMode: e.gapMode
                    }) : null)
                }, t$.useMedium(c), tU),
                np = d.forwardRef(function(e, t) {
                    return d.createElement(tX, (0, tH.pi)({}, e, {
                        ref: t,
                        sideCar: nf
                    }))
                });
            np.classNames = tX.classNames;
            var nv = [" ", "Enter", "ArrowUp", "ArrowDown"],
                nh = [" ", "Enter"],
                nm = "Select",
                [ng, ny, nw] = function(e) {
                    let t = e + "CollectionProvider",
                        [n, r] = g(t),
                        [o, i] = n(t, {
                            collectionRef: {
                                current: null
                            },
                            itemMap: new Map
                        }),
                        l = e => {
                            let {
                                scope: t,
                                children: n
                            } = e, r = d.useRef(null), i = d.useRef(new Map).current;
                            return (0, m.jsx)(o, {
                                scope: t,
                                itemMap: i,
                                collectionRef: r,
                                children: n
                            })
                        };
                    l.displayName = t;
                    let a = e + "CollectionSlot",
                        u = b(a),
                        c = d.forwardRef((e, t) => {
                            let {
                                scope: n,
                                children: r
                            } = e, o = x(t, i(a, n).collectionRef);
                            return (0, m.jsx)(u, {
                                ref: o,
                                children: r
                            })
                        });
                    c.displayName = a;
                    let s = e + "CollectionItemSlot",
                        f = "data-radix-collection-item",
                        p = b(s),
                        v = d.forwardRef((e, t) => {
                            let {
                                scope: n,
                                children: r,
                                ...o
                            } = e, l = d.useRef(null), a = x(t, l), u = i(s, n);
                            return d.useEffect(() => (u.itemMap.set(l, {
                                ref: l,
                                ...o
                            }), () => void u.itemMap.delete(l))), (0, m.jsx)(p, {
                                [f]: "",
                                ref: a,
                                children: r
                            })
                        });
                    return v.displayName = s, [{
                        Provider: l,
                        Slot: c,
                        ItemSlot: v
                    }, function(t) {
                        let n = i(e + "CollectionConsumer", t);
                        return d.useCallback(() => {
                            let e = n.collectionRef.current;
                            if (!e) return [];
                            let t = Array.from(e.querySelectorAll("[".concat(f, "]")));
                            return Array.from(n.itemMap.values()).sort((e, n) => t.indexOf(e.ref.current) - t.indexOf(n.ref.current))
                        }, [n.collectionRef, n.itemMap])
                    }, r]
                }(nm),
                [nx, nb] = g(nm, [nw, ty]),
                nE = ty(),
                [nS, nC] = nx(nm),
                [nR, nT] = nx(nm),
                nL = e => {
                    let {
                        __scopeSelect: t,
                        children: n,
                        open: r,
                        defaultOpen: o,
                        onOpenChange: i,
                        value: l,
                        defaultValue: a,
                        onValueChange: u,
                        dir: c,
                        name: s,
                        autoComplete: f,
                        disabled: p,
                        required: v,
                        form: h
                    } = e, g = nE(t), [y, w] = d.useState(null), [x, b] = d.useState(null), [E, S] = d.useState(!1), R = function(e) {
                        let t = d.useContext(C);
                        return e || t || "ltr"
                    }(c), [T, L] = tI({
                        prop: r,
                        defaultProp: null != o && o,
                        onChange: i,
                        caller: nm
                    }), [P, k] = tI({
                        prop: l,
                        defaultProp: a,
                        onChange: u,
                        caller: nm
                    }), A = d.useRef(null), N = !y || h || !!y.closest("form"), [j, M] = d.useState(new Set), D = Array.from(j).map(e => e.props.value).join(";");
                    return (0, m.jsx)(tb, { ...g,
                        children: (0, m.jsxs)(nS, {
                            required: v,
                            scope: t,
                            trigger: y,
                            onTriggerChange: w,
                            valueNode: x,
                            onValueNodeChange: b,
                            valueNodeHasChildren: E,
                            onValueNodeHasChildrenChange: S,
                            contentId: Y(),
                            value: P,
                            onValueChange: k,
                            open: T,
                            onOpenChange: L,
                            dir: R,
                            triggerPointerDownPosRef: A,
                            disabled: p,
                            children: [(0, m.jsx)(ng.Provider, {
                                scope: t,
                                children: (0, m.jsx)(nR, {
                                    scope: e.__scopeSelect,
                                    onNativeOptionAdd: d.useCallback(e => {
                                        M(t => new Set(t).add(e))
                                    }, []),
                                    onNativeOptionRemove: d.useCallback(e => {
                                        M(t => {
                                            let n = new Set(t);
                                            return n.delete(e), n
                                        })
                                    }, []),
                                    children: n
                                })
                            }), N ? (0, m.jsxs)(rr, {
                                "aria-hidden": !0,
                                required: v,
                                tabIndex: -1,
                                name: s,
                                autoComplete: f,
                                value: P,
                                onChange: e => k(e.target.value),
                                disabled: p,
                                form: h,
                                children: [void 0 === P ? (0, m.jsx)("option", {
                                    value: ""
                                }) : null, Array.from(j)]
                            }, D) : null]
                        })
                    })
                };
            nL.displayName = nm;
            var nP = "SelectTrigger",
                nk = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        disabled: r = !1,
                        ...o
                    } = e, i = nE(n), l = nC(nP, n), a = l.disabled || r, u = x(t, l.onTriggerChange), c = ny(n), s = d.useRef("touch"), [f, p, v] = ri(e => {
                        let t = c().filter(e => !e.disabled),
                            n = t.find(e => e.value === l.value),
                            r = rl(t, e, n);
                        void 0 !== r && l.onValueChange(r.value)
                    }), g = e => {
                        a || (l.onOpenChange(!0), v()), e && (l.triggerPointerDownPosRef.current = {
                            x: Math.round(e.pageX),
                            y: Math.round(e.pageY)
                        })
                    };
                    return (0, m.jsx)(tS, {
                        asChild: !0,
                        ...i,
                        children: (0, m.jsx)(R.button, {
                            type: "button",
                            role: "combobox",
                            "aria-controls": l.contentId,
                            "aria-expanded": l.open,
                            "aria-required": l.required,
                            "aria-autocomplete": "none",
                            dir: l.dir,
                            "data-state": l.open ? "open" : "closed",
                            disabled: a,
                            "data-disabled": a ? "" : void 0,
                            "data-placeholder": ro(l.value) ? "" : void 0,
                            ...o,
                            ref: u,
                            onClick: h(o.onClick, e => {
                                e.currentTarget.focus(), "mouse" !== s.current && g(e)
                            }),
                            onPointerDown: h(o.onPointerDown, e => {
                                s.current = e.pointerType;
                                let t = e.target;
                                t.hasPointerCapture(e.pointerId) && t.releasePointerCapture(e.pointerId), 0 === e.button && !1 === e.ctrlKey && "mouse" === e.pointerType && (g(e), e.preventDefault())
                            }),
                            onKeyDown: h(o.onKeyDown, e => {
                                let t = "" !== f.current;
                                e.ctrlKey || e.altKey || e.metaKey || 1 !== e.key.length || p(e.key), (!t || " " !== e.key) && nv.includes(e.key) && (g(), e.preventDefault())
                            })
                        })
                    })
                });
            nk.displayName = nP;
            var nA = "SelectValue",
                nN = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        className: r,
                        style: o,
                        children: i,
                        placeholder: l = "",
                        ...a
                    } = e, u = nC(nA, n), {
                        onValueNodeHasChildrenChange: c
                    } = u, s = void 0 !== i, d = x(t, u.onValueNodeChange);
                    return z(() => {
                        c(s)
                    }, [c, s]), (0, m.jsx)(R.span, { ...a,
                        ref: d,
                        style: {
                            pointerEvents: "none"
                        },
                        children: ro(u.value) ? (0, m.jsx)(m.Fragment, {
                            children: l
                        }) : i
                    })
                });
            nN.displayName = nA;
            var nj = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    children: r,
                    ...o
                } = e;
                return (0, m.jsx)(R.span, {
                    "aria-hidden": !0,
                    ...o,
                    ref: t,
                    children: r || "▼"
                })
            });
            nj.displayName = "SelectIcon";
            var nM = e => (0, m.jsx)(tD, {
                asChild: !0,
                ...e
            });
            nM.displayName = "SelectPortal";
            var nD = "SelectContent",
                nO = d.forwardRef((e, t) => {
                    let n = nC(nD, e.__scopeSelect),
                        [r, o] = d.useState();
                    return (z(() => {
                        o(new DocumentFragment)
                    }, []), n.open) ? (0, m.jsx)(nH, { ...e,
                        ref: t
                    }) : r ? p.createPortal((0, m.jsx)(nI, {
                        scope: e.__scopeSelect,
                        children: (0, m.jsx)(ng.Slot, {
                            scope: e.__scopeSelect,
                            children: (0, m.jsx)("div", {
                                children: e.children
                            })
                        })
                    }), r) : null
                });
            nO.displayName = nD;
            var [nI, nF] = nx(nD), n_ = b("SelectContent.RemoveScroll"), nH = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    position: r = "item-aligned",
                    onCloseAutoFocus: o,
                    onEscapeKeyDown: i,
                    onPointerDownOutside: l,
                    side: a,
                    sideOffset: u,
                    align: c,
                    alignOffset: s,
                    arrowPadding: f,
                    collisionBoundary: p,
                    collisionPadding: v,
                    sticky: g,
                    hideWhenDetached: y,
                    avoidCollisions: w,
                    ...b
                } = e, E = nC(nD, n), [S, C] = d.useState(null), [R, T] = d.useState(null), L = x(t, e => C(e)), [P, A] = d.useState(null), [N, D] = d.useState(null), O = ny(n), [I, _] = d.useState(!1), H = d.useRef(!1);
                d.useEffect(() => {
                    if (S) return (0, t_.Ry)(S)
                }, [S]), d.useEffect(() => {
                    var e, t;
                    let n = document.querySelectorAll("[data-radix-focus-guard]");
                    return document.body.insertAdjacentElement("afterbegin", null !== (e = n[0]) && void 0 !== e ? e : M()), document.body.insertAdjacentElement("beforeend", null !== (t = n[1]) && void 0 !== t ? t : M()), j++, () => {
                        1 === j && document.querySelectorAll("[data-radix-focus-guard]").forEach(e => e.remove()), j--
                    }
                }, []);
                let W = d.useCallback(e => {
                        let [t, ...n] = O().map(e => e.ref.current), [r] = n.slice(-1), o = document.activeElement;
                        for (let n of e)
                            if (n === o || (null == n || n.scrollIntoView({
                                    block: "nearest"
                                }), n === t && R && (R.scrollTop = 0), n === r && R && (R.scrollTop = R.scrollHeight), null == n || n.focus(), document.activeElement !== o)) return
                    }, [O, R]),
                    B = d.useCallback(() => W([P, S]), [W, P, S]);
                d.useEffect(() => {
                    I && B()
                }, [I, B]);
                let {
                    onOpenChange: V,
                    triggerPointerDownPosRef: z
                } = E;
                d.useEffect(() => {
                    if (S) {
                        let e = {
                                x: 0,
                                y: 0
                            },
                            t = t => {
                                var n, r, o, i;
                                e = {
                                    x: Math.abs(Math.round(t.pageX) - (null !== (o = null === (n = z.current) || void 0 === n ? void 0 : n.x) && void 0 !== o ? o : 0)),
                                    y: Math.abs(Math.round(t.pageY) - (null !== (i = null === (r = z.current) || void 0 === r ? void 0 : r.y) && void 0 !== i ? i : 0))
                                }
                            },
                            n = n => {
                                e.x <= 10 && e.y <= 10 ? n.preventDefault() : S.contains(n.target) || V(!1), document.removeEventListener("pointermove", t), z.current = null
                            };
                        return null !== z.current && (document.addEventListener("pointermove", t), document.addEventListener("pointerup", n, {
                            capture: !0,
                            once: !0
                        })), () => {
                            document.removeEventListener("pointermove", t), document.removeEventListener("pointerup", n, {
                                capture: !0
                            })
                        }
                    }
                }, [S, V, z]), d.useEffect(() => {
                    let e = () => V(!1);
                    return window.addEventListener("blur", e), window.addEventListener("resize", e), () => {
                        window.removeEventListener("blur", e), window.removeEventListener("resize", e)
                    }
                }, [V]);
                let [K, $] = ri(e => {
                    let t = O().filter(e => !e.disabled),
                        n = t.find(e => e.ref.current === document.activeElement),
                        r = rl(t, e, n);
                    r && setTimeout(() => r.ref.current.focus())
                }), Y = d.useCallback((e, t, n) => {
                    let r = !H.current && !n;
                    (void 0 !== E.value && E.value === t || r) && (A(e), r && (H.current = !0))
                }, [E.value]), X = d.useCallback(() => null == S ? void 0 : S.focus(), [S]), U = d.useCallback((e, t, n) => {
                    let r = !H.current && !n;
                    (void 0 !== E.value && E.value === t || r) && D(e)
                }, [E.value]), q = "popper" === r ? nB : nW, Z = q === nB ? {
                    side: a,
                    sideOffset: u,
                    align: c,
                    alignOffset: s,
                    arrowPadding: f,
                    collisionBoundary: p,
                    collisionPadding: v,
                    sticky: g,
                    hideWhenDetached: y,
                    avoidCollisions: w
                } : {};
                return (0, m.jsx)(nI, {
                    scope: n,
                    content: S,
                    viewport: R,
                    onViewportChange: T,
                    itemRefCallback: Y,
                    selectedItem: P,
                    onItemLeave: X,
                    itemTextRefCallback: U,
                    focusSelectedItem: B,
                    selectedItemText: N,
                    position: r,
                    isPositioned: I,
                    searchRef: K,
                    children: (0, m.jsx)(np, {
                        as: n_,
                        allowPinchZoom: !0,
                        children: (0, m.jsx)(F, {
                            asChild: !0,
                            trapped: E.open,
                            onMountAutoFocus: e => {
                                e.preventDefault()
                            },
                            onUnmountAutoFocus: h(o, e => {
                                var t;
                                null === (t = E.trigger) || void 0 === t || t.focus({
                                    preventScroll: !0
                                }), e.preventDefault()
                            }),
                            children: (0, m.jsx)(k, {
                                asChild: !0,
                                disableOutsidePointerEvents: !0,
                                onEscapeKeyDown: i,
                                onPointerDownOutside: l,
                                onFocusOutside: e => e.preventDefault(),
                                onDismiss: () => E.onOpenChange(!1),
                                children: (0, m.jsx)(q, {
                                    role: "listbox",
                                    id: E.contentId,
                                    "data-state": E.open ? "open" : "closed",
                                    dir: E.dir,
                                    onContextMenu: e => e.preventDefault(),
                                    ...b,
                                    ...Z,
                                    onPlaced: () => _(!0),
                                    ref: L,
                                    style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        outline: "none",
                                        ...b.style
                                    },
                                    onKeyDown: h(b.onKeyDown, e => {
                                        let t = e.ctrlKey || e.altKey || e.metaKey;
                                        if ("Tab" === e.key && e.preventDefault(), t || 1 !== e.key.length || $(e.key), ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
                                            let t = O().filter(e => !e.disabled).map(e => e.ref.current);
                                            if (["ArrowUp", "End"].includes(e.key) && (t = t.slice().reverse()), ["ArrowUp", "ArrowDown"].includes(e.key)) {
                                                let n = e.target,
                                                    r = t.indexOf(n);
                                                t = t.slice(r + 1)
                                            }
                                            setTimeout(() => W(t)), e.preventDefault()
                                        }
                                    })
                                })
                            })
                        })
                    })
                })
            });
            nH.displayName = "SelectContentImpl";
            var nW = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    onPlaced: r,
                    ...o
                } = e, i = nC(nD, n), l = nF(nD, n), [a, u] = d.useState(null), [c, s] = d.useState(null), f = x(t, e => s(e)), p = ny(n), h = d.useRef(!1), g = d.useRef(!0), {
                    viewport: y,
                    selectedItem: w,
                    selectedItemText: b,
                    focusSelectedItem: E
                } = l, S = d.useCallback(() => {
                    if (i.trigger && i.valueNode && a && c && y && w && b) {
                        let e = i.trigger.getBoundingClientRect(),
                            t = c.getBoundingClientRect(),
                            n = i.valueNode.getBoundingClientRect(),
                            o = b.getBoundingClientRect();
                        if ("rtl" !== i.dir) {
                            let r = o.left - t.left,
                                i = n.left - r,
                                l = e.left - i,
                                u = e.width + l,
                                c = Math.max(u, t.width),
                                s = v(i, [10, Math.max(10, window.innerWidth - 10 - c)]);
                            a.style.minWidth = u + "px", a.style.left = s + "px"
                        } else {
                            let r = t.right - o.right,
                                i = window.innerWidth - n.right - r,
                                l = window.innerWidth - e.right - i,
                                u = e.width + l,
                                c = Math.max(u, t.width),
                                s = v(i, [10, Math.max(10, window.innerWidth - 10 - c)]);
                            a.style.minWidth = u + "px", a.style.right = s + "px"
                        }
                        let l = p(),
                            u = window.innerHeight - 20,
                            s = y.scrollHeight,
                            d = window.getComputedStyle(c),
                            f = parseInt(d.borderTopWidth, 10),
                            m = parseInt(d.paddingTop, 10),
                            g = parseInt(d.borderBottomWidth, 10),
                            x = f + m + s + parseInt(d.paddingBottom, 10) + g,
                            E = Math.min(5 * w.offsetHeight, x),
                            S = window.getComputedStyle(y),
                            C = parseInt(S.paddingTop, 10),
                            R = parseInt(S.paddingBottom, 10),
                            T = e.top + e.height / 2 - 10,
                            L = w.offsetHeight / 2,
                            P = f + m + (w.offsetTop + L);
                        if (P <= T) {
                            let e = l.length > 0 && w === l[l.length - 1].ref.current;
                            a.style.bottom = "0px";
                            let t = c.clientHeight - y.offsetTop - y.offsetHeight;
                            a.style.height = P + Math.max(u - T, L + (e ? R : 0) + t + g) + "px"
                        } else {
                            let e = l.length > 0 && w === l[0].ref.current;
                            a.style.top = "0px";
                            let t = Math.max(T, f + y.offsetTop + (e ? C : 0) + L);
                            a.style.height = t + (x - P) + "px", y.scrollTop = P - T + y.offsetTop
                        }
                        a.style.margin = "".concat(10, "px 0"), a.style.minHeight = E + "px", a.style.maxHeight = u + "px", null == r || r(), requestAnimationFrame(() => h.current = !0)
                    }
                }, [p, i.trigger, i.valueNode, a, c, y, w, b, i.dir, r]);
                z(() => S(), [S]);
                let [C, T] = d.useState();
                z(() => {
                    c && T(window.getComputedStyle(c).zIndex)
                }, [c]);
                let L = d.useCallback(e => {
                    e && !0 === g.current && (S(), null == E || E(), g.current = !1)
                }, [S, E]);
                return (0, m.jsx)(nV, {
                    scope: n,
                    contentWrapper: a,
                    shouldExpandOnScrollRef: h,
                    onScrollButtonChange: L,
                    children: (0, m.jsx)("div", {
                        ref: u,
                        style: {
                            display: "flex",
                            flexDirection: "column",
                            position: "fixed",
                            zIndex: C
                        },
                        children: (0, m.jsx)(R.div, { ...o,
                            ref: f,
                            style: {
                                boxSizing: "border-box",
                                maxHeight: "100%",
                                ...o.style
                            }
                        })
                    })
                })
            });
            nW.displayName = "SelectItemAlignedPosition";
            var nB = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    align: r = "start",
                    collisionPadding: o = 10,
                    ...i
                } = e, l = nE(n);
                return (0, m.jsx)(tL, { ...l,
                    ...i,
                    ref: t,
                    align: r,
                    collisionPadding: o,
                    style: {
                        boxSizing: "border-box",
                        ...i.style,
                        "--radix-select-content-transform-origin": "var(--radix-popper-transform-origin)",
                        "--radix-select-content-available-width": "var(--radix-popper-available-width)",
                        "--radix-select-content-available-height": "var(--radix-popper-available-height)",
                        "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
                        "--radix-select-trigger-height": "var(--radix-popper-anchor-height)"
                    }
                })
            });
            nB.displayName = "SelectPopperPosition";
            var [nV, nz] = nx(nD, {}), nK = "SelectViewport", n$ = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    nonce: r,
                    ...o
                } = e, i = nF(nK, n), l = nz(nK, n), a = x(t, i.onViewportChange), u = d.useRef(0);
                return (0, m.jsxs)(m.Fragment, {
                    children: [(0, m.jsx)("style", {
                        dangerouslySetInnerHTML: {
                            __html: "[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}"
                        },
                        nonce: r
                    }), (0, m.jsx)(ng.Slot, {
                        scope: n,
                        children: (0, m.jsx)(R.div, {
                            "data-radix-select-viewport": "",
                            role: "presentation",
                            ...o,
                            ref: a,
                            style: {
                                position: "relative",
                                flex: 1,
                                overflow: "hidden auto",
                                ...o.style
                            },
                            onScroll: h(o.onScroll, e => {
                                let t = e.currentTarget,
                                    {
                                        contentWrapper: n,
                                        shouldExpandOnScrollRef: r
                                    } = l;
                                if ((null == r ? void 0 : r.current) && n) {
                                    let e = Math.abs(u.current - t.scrollTop);
                                    if (e > 0) {
                                        let r = window.innerHeight - 20,
                                            o = Math.max(parseFloat(n.style.minHeight), parseFloat(n.style.height));
                                        if (o < r) {
                                            let i = o + e,
                                                l = Math.min(r, i),
                                                a = i - l;
                                            n.style.height = l + "px", "0px" === n.style.bottom && (t.scrollTop = a > 0 ? a : 0, n.style.justifyContent = "flex-end")
                                        }
                                    }
                                }
                                u.current = t.scrollTop
                            })
                        })
                    })]
                })
            });
            n$.displayName = nK;
            var nY = "SelectGroup",
                [nX, nU] = nx(nY),
                nq = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        ...r
                    } = e, o = Y();
                    return (0, m.jsx)(nX, {
                        scope: n,
                        id: o,
                        children: (0, m.jsx)(R.div, {
                            role: "group",
                            "aria-labelledby": o,
                            ...r,
                            ref: t
                        })
                    })
                });
            nq.displayName = nY;
            var nZ = "SelectLabel",
                nG = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        ...r
                    } = e, o = nU(nZ, n);
                    return (0, m.jsx)(R.div, {
                        id: o.id,
                        ...r,
                        ref: t
                    })
                });
            nG.displayName = nZ;
            var nJ = "SelectItem",
                [nQ, n0] = nx(nJ),
                n1 = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        value: r,
                        disabled: o = !1,
                        textValue: i,
                        ...l
                    } = e, a = nC(nJ, n), u = nF(nJ, n), c = a.value === r, [s, f] = d.useState(null != i ? i : ""), [p, v] = d.useState(!1), g = x(t, e => {
                        var t;
                        return null === (t = u.itemRefCallback) || void 0 === t ? void 0 : t.call(u, e, r, o)
                    }), y = Y(), w = d.useRef("touch"), b = () => {
                        o || (a.onValueChange(r), a.onOpenChange(!1))
                    };
                    if ("" === r) throw Error("A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.");
                    return (0, m.jsx)(nQ, {
                        scope: n,
                        value: r,
                        disabled: o,
                        textId: y,
                        isSelected: c,
                        onItemTextChange: d.useCallback(e => {
                            f(t => {
                                var n;
                                return t || (null !== (n = null == e ? void 0 : e.textContent) && void 0 !== n ? n : "").trim()
                            })
                        }, []),
                        children: (0, m.jsx)(ng.ItemSlot, {
                            scope: n,
                            value: r,
                            disabled: o,
                            textValue: s,
                            children: (0, m.jsx)(R.div, {
                                role: "option",
                                "aria-labelledby": y,
                                "data-highlighted": p ? "" : void 0,
                                "aria-selected": c && p,
                                "data-state": c ? "checked" : "unchecked",
                                "aria-disabled": o || void 0,
                                "data-disabled": o ? "" : void 0,
                                tabIndex: o ? void 0 : -1,
                                ...l,
                                ref: g,
                                onFocus: h(l.onFocus, () => v(!0)),
                                onBlur: h(l.onBlur, () => v(!1)),
                                onClick: h(l.onClick, () => {
                                    "mouse" !== w.current && b()
                                }),
                                onPointerUp: h(l.onPointerUp, () => {
                                    "mouse" === w.current && b()
                                }),
                                onPointerDown: h(l.onPointerDown, e => {
                                    w.current = e.pointerType
                                }),
                                onPointerMove: h(l.onPointerMove, e => {
                                    if (w.current = e.pointerType, o) {
                                        var t;
                                        null === (t = u.onItemLeave) || void 0 === t || t.call(u)
                                    } else "mouse" === w.current && e.currentTarget.focus({
                                        preventScroll: !0
                                    })
                                }),
                                onPointerLeave: h(l.onPointerLeave, e => {
                                    if (e.currentTarget === document.activeElement) {
                                        var t;
                                        null === (t = u.onItemLeave) || void 0 === t || t.call(u)
                                    }
                                }),
                                onKeyDown: h(l.onKeyDown, e => {
                                    var t;
                                    (null === (t = u.searchRef) || void 0 === t ? void 0 : t.current) !== "" && " " === e.key || (nh.includes(e.key) && b(), " " === e.key && e.preventDefault())
                                })
                            })
                        })
                    })
                });
            n1.displayName = nJ;
            var n2 = "SelectItemText",
                n5 = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        className: r,
                        style: o,
                        ...i
                    } = e, l = nC(n2, n), a = nF(n2, n), u = n0(n2, n), c = nT(n2, n), [s, f] = d.useState(null), v = x(t, e => f(e), u.onItemTextChange, e => {
                        var t;
                        return null === (t = a.itemTextRefCallback) || void 0 === t ? void 0 : t.call(a, e, u.value, u.disabled)
                    }), h = null == s ? void 0 : s.textContent, g = d.useMemo(() => (0, m.jsx)("option", {
                        value: u.value,
                        disabled: u.disabled,
                        children: h
                    }, u.value), [u.disabled, u.value, h]), {
                        onNativeOptionAdd: y,
                        onNativeOptionRemove: w
                    } = c;
                    return z(() => (y(g), () => w(g)), [y, w, g]), (0, m.jsxs)(m.Fragment, {
                        children: [(0, m.jsx)(R.span, {
                            id: u.textId,
                            ...i,
                            ref: v
                        }), u.isSelected && l.valueNode && !l.valueNodeHasChildren ? p.createPortal(i.children, l.valueNode) : null]
                    })
                });
            n5.displayName = n2;
            var n3 = "SelectItemIndicator",
                n6 = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        ...r
                    } = e;
                    return n0(n3, n).isSelected ? (0, m.jsx)(R.span, {
                        "aria-hidden": !0,
                        ...r,
                        ref: t
                    }) : null
                });
            n6.displayName = n3;
            var n8 = "SelectScrollUpButton",
                n4 = d.forwardRef((e, t) => {
                    let n = nF(n8, e.__scopeSelect),
                        r = nz(n8, e.__scopeSelect),
                        [o, i] = d.useState(!1),
                        l = x(t, r.onScrollButtonChange);
                    return z(() => {
                        if (n.viewport && n.isPositioned) {
                            let e = function() {
                                    i(t.scrollTop > 0)
                                },
                                t = n.viewport;
                            return e(), t.addEventListener("scroll", e), () => t.removeEventListener("scroll", e)
                        }
                    }, [n.viewport, n.isPositioned]), o ? (0, m.jsx)(re, { ...e,
                        ref: l,
                        onAutoScroll: () => {
                            let {
                                viewport: e,
                                selectedItem: t
                            } = n;
                            e && t && (e.scrollTop = e.scrollTop - t.offsetHeight)
                        }
                    }) : null
                });
            n4.displayName = n8;
            var n7 = "SelectScrollDownButton",
                n9 = d.forwardRef((e, t) => {
                    let n = nF(n7, e.__scopeSelect),
                        r = nz(n7, e.__scopeSelect),
                        [o, i] = d.useState(!1),
                        l = x(t, r.onScrollButtonChange);
                    return z(() => {
                        if (n.viewport && n.isPositioned) {
                            let e = function() {
                                    let e = t.scrollHeight - t.clientHeight;
                                    i(Math.ceil(t.scrollTop) < e)
                                },
                                t = n.viewport;
                            return e(), t.addEventListener("scroll", e), () => t.removeEventListener("scroll", e)
                        }
                    }, [n.viewport, n.isPositioned]), o ? (0, m.jsx)(re, { ...e,
                        ref: l,
                        onAutoScroll: () => {
                            let {
                                viewport: e,
                                selectedItem: t
                            } = n;
                            e && t && (e.scrollTop = e.scrollTop + t.offsetHeight)
                        }
                    }) : null
                });
            n9.displayName = n7;
            var re = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        onAutoScroll: r,
                        ...o
                    } = e, i = nF("SelectScrollButton", n), l = d.useRef(null), a = ny(n), u = d.useCallback(() => {
                        null !== l.current && (window.clearInterval(l.current), l.current = null)
                    }, []);
                    return d.useEffect(() => () => u(), [u]), z(() => {
                        var e;
                        let t = a().find(e => e.ref.current === document.activeElement);
                        null == t || null === (e = t.ref.current) || void 0 === e || e.scrollIntoView({
                            block: "nearest"
                        })
                    }, [a]), (0, m.jsx)(R.div, {
                        "aria-hidden": !0,
                        ...o,
                        ref: t,
                        style: {
                            flexShrink: 0,
                            ...o.style
                        },
                        onPointerDown: h(o.onPointerDown, () => {
                            null === l.current && (l.current = window.setInterval(r, 50))
                        }),
                        onPointerMove: h(o.onPointerMove, () => {
                            var e;
                            null === (e = i.onItemLeave) || void 0 === e || e.call(i), null === l.current && (l.current = window.setInterval(r, 50))
                        }),
                        onPointerLeave: h(o.onPointerLeave, () => {
                            u()
                        })
                    })
                }),
                rt = d.forwardRef((e, t) => {
                    let {
                        __scopeSelect: n,
                        ...r
                    } = e;
                    return (0, m.jsx)(R.div, {
                        "aria-hidden": !0,
                        ...r,
                        ref: t
                    })
                });
            rt.displayName = "SelectSeparator";
            var rn = "SelectArrow";
            d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    ...r
                } = e, o = nE(n), i = nC(rn, n), l = nF(rn, n);
                return i.open && "popper" === l.position ? (0, m.jsx)(tA, { ...o,
                    ...r,
                    ref: t
                }) : null
            }).displayName = rn;
            var rr = d.forwardRef((e, t) => {
                let {
                    __scopeSelect: n,
                    value: r,
                    ...o
                } = e, i = d.useRef(null), l = x(t, i), a = function(e) {
                    let t = d.useRef({
                        value: e,
                        previous: e
                    });
                    return d.useMemo(() => (t.current.value !== e && (t.current.previous = t.current.value, t.current.value = e), t.current.previous), [e])
                }(r);
                return d.useEffect(() => {
                    let e = i.current;
                    if (!e) return;
                    let t = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
                    if (a !== r && t) {
                        let n = new Event("change", {
                            bubbles: !0
                        });
                        t.call(e, r), e.dispatchEvent(n)
                    }
                }, [a, r]), (0, m.jsx)(R.select, { ...o,
                    style: { ...tF,
                        ...o.style
                    },
                    ref: l,
                    defaultValue: r
                })
            });

            function ro(e) {
                return "" === e || void 0 === e
            }

            function ri(e) {
                let t = T(e),
                    n = d.useRef(""),
                    r = d.useRef(0),
                    o = d.useCallback(e => {
                        let o = n.current + e;
                        t(o),
                            function e(t) {
                                n.current = t, window.clearTimeout(r.current), "" !== t && (r.current = window.setTimeout(() => e(""), 1e3))
                            }(o)
                    }, [t]),
                    i = d.useCallback(() => {
                        n.current = "", window.clearTimeout(r.current)
                    }, []);
                return d.useEffect(() => () => window.clearTimeout(r.current), []), [n, o, i]
            }

            function rl(e, t, n) {
                var r;
                let o = t.length > 1 && Array.from(t).every(e => e === t[0]) ? t[0] : t,
                    i = (r = Math.max(n ? e.indexOf(n) : -1, 0), e.map((t, n) => e[(r + n) % e.length]));
                1 === o.length && (i = i.filter(e => e !== n));
                let l = i.find(e => e.textValue.toLowerCase().startsWith(o.toLowerCase()));
                return l !== n ? l : void 0
            }
            rr.displayName = "SelectBubbleInput";
            var ra = nL,
                ru = nk,
                rc = nN,
                rs = nj,
                rd = nM,
                rf = nO,
                rp = n$,
                rv = nq,
                rh = nG,
                rm = n1,
                rg = n5,
                ry = n6,
                rw = n4,
                rx = n9,
                rb = rt
        }
    }
]);