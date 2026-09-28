(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [1478], {
        5670: function(e, t, r) {
            var n = 0 / 0,
                o = /^\s+|\s+$/g,
                i = /^[-+]0x[0-9a-f]+$/i,
                a = /^0b[01]+$/i,
                u = /^0o[0-7]+$/i,
                l = parseInt,
                s = "object" == typeof r.g && r.g && r.g.Object === Object && r.g,
                c = "object" == typeof self && self && self.Object === Object && self,
                d = s || c || Function("return this")(),
                f = Object.prototype.toString,
                p = Math.max,
                v = Math.min,
                h = function() {
                    return d.Date.now()
                };

            function g(e) {
                var t = typeof e;
                return !!e && ("object" == t || "function" == t)
            }

            function y(e) {
                if ("number" == typeof e) return e;
                if ("symbol" == typeof(t = e) || t && "object" == typeof t && "[object Symbol]" == f.call(t)) return n;
                if (g(e)) {
                    var t, r = "function" == typeof e.valueOf ? e.valueOf() : e;
                    e = g(r) ? r + "" : r
                }
                if ("string" != typeof e) return 0 === e ? e : +e;
                e = e.replace(o, "");
                var s = a.test(e);
                return s || u.test(e) ? l(e.slice(2), s ? 2 : 8) : i.test(e) ? n : +e
            }
            e.exports = function(e, t, r) {
                var n, o, i, a, u, l, s = 0,
                    c = !1,
                    d = !1,
                    f = !0;
                if ("function" != typeof e) throw TypeError("Expected a function");

                function w(t) {
                    var r = n,
                        i = o;
                    return n = o = void 0, s = t, a = e.apply(i, r)
                }

                function m(e) {
                    var r = e - l,
                        n = e - s;
                    return void 0 === l || r >= t || r < 0 || d && n >= i
                }

                function b() {
                    var e, r, n, o = h();
                    if (m(o)) return x(o);
                    u = setTimeout(b, (e = o - l, r = o - s, n = t - e, d ? v(n, i - r) : n))
                }

                function x(e) {
                    return (u = void 0, f && n) ? w(e) : (n = o = void 0, a)
                }

                function E() {
                    var e, r = h(),
                        i = m(r);
                    if (n = arguments, o = this, l = r, i) {
                        if (void 0 === u) return s = e = l, u = setTimeout(b, t), c ? w(e) : a;
                        if (d) return u = setTimeout(b, t), w(l)
                    }
                    return void 0 === u && (u = setTimeout(b, t)), a
                }
                return t = y(t) || 0, g(r) && (c = !!r.leading, i = (d = "maxWait" in r) ? p(y(r.maxWait) || 0, t) : i, f = "trailing" in r ? !!r.trailing : f), E.cancel = function() {
                    void 0 !== u && clearTimeout(u), s = 0, n = l = o = u = void 0
                }, E.flush = function() {
                    return void 0 === u ? a : x(h())
                }, E
            }
        },
        72534: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ArrowUpRight", [
                ["path", {
                    d: "M7 7h10v10",
                    key: "1tivn9"
                }],
                ["path", {
                    d: "M7 17 17 7",
                    key: "1vkiza"
                }]
            ])
        },
        37687: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ChevronDown", [
                ["path", {
                    d: "m6 9 6 6 6-6",
                    key: "qrunsl"
                }]
            ])
        },
        45640: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ChevronRight", [
                ["path", {
                    d: "m9 18 6-6-6-6",
                    key: "mthhwq"
                }]
            ])
        },
        86128: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ExternalLink", [
                ["path", {
                    d: "M15 3h6v6",
                    key: "1q9fwt"
                }],
                ["path", {
                    d: "M10 14 21 3",
                    key: "gplh6r"
                }],
                ["path", {
                    d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
                    key: "a6xqqp"
                }]
            ])
        },
        58120: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("PanelLeft", [
                ["rect", {
                    width: "18",
                    height: "18",
                    x: "3",
                    y: "3",
                    rx: "2",
                    key: "afitv7"
                }],
                ["path", {
                    d: "M9 3v18",
                    key: "fh3hqa"
                }]
            ])
        },
        73249: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("RefreshCw", [
                ["path", {
                    d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
                    key: "v9h5vc"
                }],
                ["path", {
                    d: "M21 3v5h-5",
                    key: "1q7to0"
                }],
                ["path", {
                    d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
                    key: "3uifl3"
                }],
                ["path", {
                    d: "M8 16H3v5",
                    key: "1cv678"
                }]
            ])
        },
        50761: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("Sparkles", [
                ["path", {
                    d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
                    key: "4pj2yx"
                }],
                ["path", {
                    d: "M20 3v4",
                    key: "1olli1"
                }],
                ["path", {
                    d: "M22 5h-4",
                    key: "1gvqau"
                }],
                ["path", {
                    d: "M4 17v2",
                    key: "vumght"
                }],
                ["path", {
                    d: "M5 18H3",
                    key: "zchphs"
                }]
            ])
        },
        47068: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("TrendingUp", [
                ["polyline", {
                    points: "22 7 13.5 15.5 8.5 10.5 2 17",
                    key: "126l90"
                }],
                ["polyline", {
                    points: "16 7 22 7 22 13",
                    key: "kwv8wd"
                }]
            ])
        },
        76840: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("TriangleAlert", [
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
        51281: function(e, t, r) {
            "use strict";
            var n = r(55185),
                o = "function" == typeof Object.is ? Object.is : function(e, t) {
                    return e === t && (0 !== e || 1 / e == 1 / t) || e != e && t != t
                },
                i = n.useState,
                a = n.useEffect,
                u = n.useLayoutEffect,
                l = n.useDebugValue;

            function s(e) {
                var t = e.getSnapshot;
                e = e.value;
                try {
                    var r = t();
                    return !o(e, r)
                } catch (e) {
                    return !0
                }
            }
            var c = "undefined" == typeof window || void 0 === window.document || void 0 === window.document.createElement ? function(e, t) {
                return t()
            } : function(e, t) {
                var r = t(),
                    n = i({
                        inst: {
                            value: r,
                            getSnapshot: t
                        }
                    }),
                    o = n[0].inst,
                    c = n[1];
                return u(function() {
                    o.value = r, o.getSnapshot = t, s(o) && c({
                        inst: o
                    })
                }, [e, r, t]), a(function() {
                    return s(o) && c({
                        inst: o
                    }), e(function() {
                        s(o) && c({
                            inst: o
                        })
                    })
                }, [e]), l(r), r
            };
            t.useSyncExternalStore = void 0 !== n.useSyncExternalStore ? n.useSyncExternalStore : c
        },
        3752: function(e, t, r) {
            "use strict";
            e.exports = r(51281)
        },
        49940: function(e, t, r) {
            "use strict";
            r.d(t, {
                VY: function() {
                    return $
                },
                fC: function() {
                    return W
                },
                h_: function() {
                    return q
                },
                xz: function() {
                    return z
                }
            });
            var n = r(55185),
                o = r(4142),
                i = r(46121),
                a = r(70358),
                u = r(30521),
                l = r(14074),
                s = r(91926),
                c = r(43794),
                d = r(71872),
                f = r(93958),
                p = r(15624),
                v = r(56366),
                h = r(33658),
                g = r(63485),
                y = r(34467),
                w = r(13158),
                m = r(10131),
                b = "Popover",
                [x, E] = (0, a.b)(b, [d.D7]),
                O = (0, d.D7)(),
                [C, k] = x(b),
                j = e => {
                    let {
                        __scopePopover: t,
                        children: r,
                        open: o,
                        defaultOpen: i,
                        onOpenChange: a,
                        modal: u = !1
                    } = e, l = O(t), s = n.useRef(null), [f, p] = n.useState(!1), [v = !1, h] = (0, g.T)({
                        prop: o,
                        defaultProp: i,
                        onChange: a
                    });
                    return (0, m.jsx)(d.fC, { ...l,
                        children: (0, m.jsx)(C, {
                            scope: t,
                            contentId: (0, c.M)(),
                            triggerRef: s,
                            open: v,
                            onOpenChange: h,
                            onOpenToggle: n.useCallback(() => h(e => !e), [h]),
                            hasCustomAnchor: f,
                            onCustomAnchorAdd: n.useCallback(() => p(!0), []),
                            onCustomAnchorRemove: n.useCallback(() => p(!1), []),
                            modal: u,
                            children: r
                        })
                    })
                };
            j.displayName = b;
            var R = "PopoverAnchor";
            n.forwardRef((e, t) => {
                let {
                    __scopePopover: r,
                    ...o
                } = e, i = k(R, r), a = O(r), {
                    onCustomAnchorAdd: u,
                    onCustomAnchorRemove: l
                } = i;
                return n.useEffect(() => (u(), () => l()), [u, l]), (0, m.jsx)(d.ee, { ...a,
                    ...o,
                    ref: t
                })
            }).displayName = R;
            var T = "PopoverTrigger",
                _ = n.forwardRef((e, t) => {
                    let {
                        __scopePopover: r,
                        ...n
                    } = e, a = k(T, r), u = O(r), l = (0, i.e)(t, a.triggerRef), s = (0, m.jsx)(v.WV.button, {
                        type: "button",
                        "aria-haspopup": "dialog",
                        "aria-expanded": a.open,
                        "aria-controls": a.contentId,
                        "data-state": Z(a.open),
                        ...n,
                        ref: l,
                        onClick: (0, o.M)(e.onClick, a.onOpenToggle)
                    });
                    return a.hasCustomAnchor ? s : (0, m.jsx)(d.ee, {
                        asChild: !0,
                        ...u,
                        children: s
                    })
                });
            _.displayName = T;
            var P = "PopoverPortal",
                [M, L] = x(P, {
                    forceMount: void 0
                }),
                S = e => {
                    let {
                        __scopePopover: t,
                        forceMount: r,
                        children: n,
                        container: o
                    } = e, i = k(P, t);
                    return (0, m.jsx)(M, {
                        scope: t,
                        forceMount: r,
                        children: (0, m.jsx)(p.z, {
                            present: r || i.open,
                            children: (0, m.jsx)(f.h, {
                                asChild: !0,
                                container: o,
                                children: n
                            })
                        })
                    })
                };
            S.displayName = P;
            var D = "PopoverContent",
                N = n.forwardRef((e, t) => {
                    let r = L(D, e.__scopePopover),
                        {
                            forceMount: n = r.forceMount,
                            ...o
                        } = e,
                        i = k(D, e.__scopePopover);
                    return (0, m.jsx)(p.z, {
                        present: n || i.open,
                        children: i.modal ? (0, m.jsx)(V, { ...o,
                            ref: t
                        }) : (0, m.jsx)(A, { ...o,
                            ref: t
                        })
                    })
                });
            N.displayName = D;
            var V = n.forwardRef((e, t) => {
                    let r = k(D, e.__scopePopover),
                        a = n.useRef(null),
                        u = (0, i.e)(t, a),
                        l = n.useRef(!1);
                    return n.useEffect(() => {
                        let e = a.current;
                        if (e) return (0, y.Ry)(e)
                    }, []), (0, m.jsx)(w.Z, {
                        as: h.g7,
                        allowPinchZoom: !0,
                        children: (0, m.jsx)(I, { ...e,
                            ref: u,
                            trapFocus: r.open,
                            disableOutsidePointerEvents: !0,
                            onCloseAutoFocus: (0, o.M)(e.onCloseAutoFocus, e => {
                                var t;
                                e.preventDefault(), l.current || null === (t = r.triggerRef.current) || void 0 === t || t.focus()
                            }),
                            onPointerDownOutside: (0, o.M)(e.onPointerDownOutside, e => {
                                let t = e.detail.originalEvent,
                                    r = 0 === t.button && !0 === t.ctrlKey,
                                    n = 2 === t.button || r;
                                l.current = n
                            }, {
                                checkForDefaultPrevented: !1
                            }),
                            onFocusOutside: (0, o.M)(e.onFocusOutside, e => e.preventDefault(), {
                                checkForDefaultPrevented: !1
                            })
                        })
                    })
                }),
                A = n.forwardRef((e, t) => {
                    let r = k(D, e.__scopePopover),
                        o = n.useRef(!1),
                        i = n.useRef(!1);
                    return (0, m.jsx)(I, { ...e,
                        ref: t,
                        trapFocus: !1,
                        disableOutsidePointerEvents: !1,
                        onCloseAutoFocus: t => {
                            var n, a;
                            null === (n = e.onCloseAutoFocus) || void 0 === n || n.call(e, t), t.defaultPrevented || (o.current || null === (a = r.triggerRef.current) || void 0 === a || a.focus(), t.preventDefault()), o.current = !1, i.current = !1
                        },
                        onInteractOutside: t => {
                            var n, a;
                            null === (n = e.onInteractOutside) || void 0 === n || n.call(e, t), t.defaultPrevented || (o.current = !0, "pointerdown" !== t.detail.originalEvent.type || (i.current = !0));
                            let u = t.target;
                            (null === (a = r.triggerRef.current) || void 0 === a ? void 0 : a.contains(u)) && t.preventDefault(), "focusin" === t.detail.originalEvent.type && i.current && t.preventDefault()
                        }
                    })
                }),
                I = n.forwardRef((e, t) => {
                    let {
                        __scopePopover: r,
                        trapFocus: n,
                        onOpenAutoFocus: o,
                        onCloseAutoFocus: i,
                        disableOutsidePointerEvents: a,
                        onEscapeKeyDown: c,
                        onPointerDownOutside: f,
                        onFocusOutside: p,
                        onInteractOutside: v,
                        ...h
                    } = e, g = k(D, r), y = O(r);
                    return (0, l.EW)(), (0, m.jsx)(s.M, {
                        asChild: !0,
                        loop: !0,
                        trapped: n,
                        onMountAutoFocus: o,
                        onUnmountAutoFocus: i,
                        children: (0, m.jsx)(u.XB, {
                            asChild: !0,
                            disableOutsidePointerEvents: a,
                            onInteractOutside: v,
                            onEscapeKeyDown: c,
                            onPointerDownOutside: f,
                            onFocusOutside: p,
                            onDismiss: () => g.onOpenChange(!1),
                            children: (0, m.jsx)(d.VY, {
                                "data-state": Z(g.open),
                                role: "dialog",
                                id: g.contentId,
                                ...y,
                                ...h,
                                ref: t,
                                style: { ...h.style,
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
                F = "PopoverClose";

            function Z(e) {
                return e ? "open" : "closed"
            }
            n.forwardRef((e, t) => {
                let {
                    __scopePopover: r,
                    ...n
                } = e, i = k(F, r);
                return (0, m.jsx)(v.WV.button, {
                    type: "button",
                    ...n,
                    ref: t,
                    onClick: (0, o.M)(e.onClick, () => i.onOpenChange(!1))
                })
            }).displayName = F, n.forwardRef((e, t) => {
                let {
                    __scopePopover: r,
                    ...n
                } = e, o = O(r);
                return (0, m.jsx)(d.Eh, { ...o,
                    ...n,
                    ref: t
                })
            }).displayName = "PopoverArrow";
            var W = j,
                z = _,
                q = S,
                $ = N
        },
        6318: function(e, t, r) {
            "use strict";
            r.d(t, {
                f: function() {
                    return s
                }
            });
            var n = r(55185),
                o = r(56366),
                i = r(10131),
                a = "horizontal",
                u = ["horizontal", "vertical"],
                l = n.forwardRef((e, t) => {
                    let {
                        decorative: r,
                        orientation: n = a,
                        ...l
                    } = e, s = u.includes(n) ? n : a;
                    return (0, i.jsx)(o.WV.div, {
                        "data-orientation": s,
                        ...r ? {
                            role: "none"
                        } : {
                            "aria-orientation": "vertical" === s ? s : void 0,
                            role: "separator"
                        },
                        ...l,
                        ref: t
                    })
                });
            l.displayName = "Separator";
            var s = l
        },
        24911: function(e, t, r) {
            "use strict";
            r.d(t, {
                VY: function() {
                    return B
                },
                h_: function() {
                    return U
                },
                zt: function() {
                    return z
                },
                fC: function() {
                    return q
                },
                u: function() {
                    return T
                },
                xz: function() {
                    return $
                }
            });
            var n = r(55185),
                o = r(4142),
                i = r(46121),
                a = r(70358),
                u = r(30521),
                l = r(43794),
                s = r(71872),
                c = r(93958),
                d = r(15624),
                f = r(56366),
                p = r(33658),
                v = r(63485),
                h = r(10131),
                g = n.forwardRef((e, t) => (0, h.jsx)(f.WV.span, { ...e,
                    ref: t,
                    style: {
                        position: "absolute",
                        border: 0,
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: "hidden",
                        clip: "rect(0, 0, 0, 0)",
                        whiteSpace: "nowrap",
                        wordWrap: "normal",
                        ...e.style
                    }
                }));
            g.displayName = "VisuallyHidden";
            var [y, w] = (0, a.b)("Tooltip", [s.D7]), m = (0, s.D7)(), b = "TooltipProvider", x = "tooltip.open", [E, O] = y(b), C = e => {
                let {
                    __scopeTooltip: t,
                    delayDuration: r = 700,
                    skipDelayDuration: o = 300,
                    disableHoverableContent: i = !1,
                    children: a
                } = e, [u, l] = n.useState(!0), s = n.useRef(!1), c = n.useRef(0);
                return n.useEffect(() => {
                    let e = c.current;
                    return () => window.clearTimeout(e)
                }, []), (0, h.jsx)(E, {
                    scope: t,
                    isOpenDelayed: u,
                    delayDuration: r,
                    onOpen: n.useCallback(() => {
                        window.clearTimeout(c.current), l(!1)
                    }, []),
                    onClose: n.useCallback(() => {
                        window.clearTimeout(c.current), c.current = window.setTimeout(() => l(!0), o)
                    }, [o]),
                    isPointerInTransitRef: s,
                    onPointerInTransitChange: n.useCallback(e => {
                        s.current = e
                    }, []),
                    disableHoverableContent: i,
                    children: a
                })
            };
            C.displayName = b;
            var k = "Tooltip",
                [j, R] = y(k),
                T = e => {
                    let {
                        __scopeTooltip: t,
                        children: r,
                        open: o,
                        defaultOpen: i = !1,
                        onOpenChange: a,
                        disableHoverableContent: u,
                        delayDuration: c
                    } = e, d = O(k, e.__scopeTooltip), f = m(t), [p, g] = n.useState(null), y = (0, l.M)(), w = n.useRef(0), b = null != u ? u : d.disableHoverableContent, E = null != c ? c : d.delayDuration, C = n.useRef(!1), [R = !1, T] = (0, v.T)({
                        prop: o,
                        defaultProp: i,
                        onChange: e => {
                            e ? (d.onOpen(), document.dispatchEvent(new CustomEvent(x))) : d.onClose(), null == a || a(e)
                        }
                    }), _ = n.useMemo(() => R ? C.current ? "delayed-open" : "instant-open" : "closed", [R]), P = n.useCallback(() => {
                        window.clearTimeout(w.current), C.current = !1, T(!0)
                    }, [T]), M = n.useCallback(() => {
                        window.clearTimeout(w.current), T(!1)
                    }, [T]), L = n.useCallback(() => {
                        window.clearTimeout(w.current), w.current = window.setTimeout(() => {
                            C.current = !0, T(!0)
                        }, E)
                    }, [E, T]);
                    return n.useEffect(() => () => window.clearTimeout(w.current), []), (0, h.jsx)(s.fC, { ...f,
                        children: (0, h.jsx)(j, {
                            scope: t,
                            contentId: y,
                            open: R,
                            stateAttribute: _,
                            trigger: p,
                            onTriggerChange: g,
                            onTriggerEnter: n.useCallback(() => {
                                d.isOpenDelayed ? L() : P()
                            }, [d.isOpenDelayed, L, P]),
                            onTriggerLeave: n.useCallback(() => {
                                b ? M() : window.clearTimeout(w.current)
                            }, [M, b]),
                            onOpen: P,
                            onClose: M,
                            disableHoverableContent: b,
                            children: r
                        })
                    })
                };
            T.displayName = k;
            var _ = "TooltipTrigger",
                P = n.forwardRef((e, t) => {
                    let {
                        __scopeTooltip: r,
                        ...a
                    } = e, u = R(_, r), l = O(_, r), c = m(r), d = n.useRef(null), p = (0, i.e)(t, d, u.onTriggerChange), v = n.useRef(!1), g = n.useRef(!1), y = n.useCallback(() => v.current = !1, []);
                    return n.useEffect(() => () => document.removeEventListener("pointerup", y), [y]), (0, h.jsx)(s.ee, {
                        asChild: !0,
                        ...c,
                        children: (0, h.jsx)(f.WV.button, {
                            "aria-describedby": u.open ? u.contentId : void 0,
                            "data-state": u.stateAttribute,
                            ...a,
                            ref: p,
                            onPointerMove: (0, o.M)(e.onPointerMove, e => {
                                "touch" === e.pointerType || g.current || l.isPointerInTransitRef.current || (u.onTriggerEnter(), g.current = !0)
                            }),
                            onPointerLeave: (0, o.M)(e.onPointerLeave, () => {
                                u.onTriggerLeave(), g.current = !1
                            }),
                            onPointerDown: (0, o.M)(e.onPointerDown, () => {
                                v.current = !0, document.addEventListener("pointerup", y, {
                                    once: !0
                                })
                            }),
                            onFocus: (0, o.M)(e.onFocus, () => {
                                v.current || u.onOpen()
                            }),
                            onBlur: (0, o.M)(e.onBlur, u.onClose),
                            onClick: (0, o.M)(e.onClick, u.onClose)
                        })
                    })
                });
            P.displayName = _;
            var M = "TooltipPortal",
                [L, S] = y(M, {
                    forceMount: void 0
                }),
                D = e => {
                    let {
                        __scopeTooltip: t,
                        forceMount: r,
                        children: n,
                        container: o
                    } = e, i = R(M, t);
                    return (0, h.jsx)(L, {
                        scope: t,
                        forceMount: r,
                        children: (0, h.jsx)(d.z, {
                            present: r || i.open,
                            children: (0, h.jsx)(c.h, {
                                asChild: !0,
                                container: o,
                                children: n
                            })
                        })
                    })
                };
            D.displayName = M;
            var N = "TooltipContent",
                V = n.forwardRef((e, t) => {
                    let r = S(N, e.__scopeTooltip),
                        {
                            forceMount: n = r.forceMount,
                            side: o = "top",
                            ...i
                        } = e,
                        a = R(N, e.__scopeTooltip);
                    return (0, h.jsx)(d.z, {
                        present: n || a.open,
                        children: a.disableHoverableContent ? (0, h.jsx)(Z, {
                            side: o,
                            ...i,
                            ref: t
                        }) : (0, h.jsx)(A, {
                            side: o,
                            ...i,
                            ref: t
                        })
                    })
                }),
                A = n.forwardRef((e, t) => {
                    let r = R(N, e.__scopeTooltip),
                        o = O(N, e.__scopeTooltip),
                        a = n.useRef(null),
                        u = (0, i.e)(t, a),
                        [l, s] = n.useState(null),
                        {
                            trigger: c,
                            onClose: d
                        } = r,
                        f = a.current,
                        {
                            onPointerInTransitChange: p
                        } = o,
                        v = n.useCallback(() => {
                            s(null), p(!1)
                        }, [p]),
                        g = n.useCallback((e, t) => {
                            let r = e.currentTarget,
                                n = {
                                    x: e.clientX,
                                    y: e.clientY
                                },
                                o = function(e, t) {
                                    let r = Math.abs(t.top - e.y),
                                        n = Math.abs(t.bottom - e.y),
                                        o = Math.abs(t.right - e.x),
                                        i = Math.abs(t.left - e.x);
                                    switch (Math.min(r, n, o, i)) {
                                        case i:
                                            return "left";
                                        case o:
                                            return "right";
                                        case r:
                                            return "top";
                                        case n:
                                            return "bottom";
                                        default:
                                            throw Error("unreachable")
                                    }
                                }(n, r.getBoundingClientRect());
                            s(function(e) {
                                let t = e.slice();
                                return t.sort((e, t) => e.x < t.x ? -1 : e.x > t.x ? 1 : e.y < t.y ? -1 : e.y > t.y ? 1 : 0),
                                    function(e) {
                                        if (e.length <= 1) return e.slice();
                                        let t = [];
                                        for (let r = 0; r < e.length; r++) {
                                            let n = e[r];
                                            for (; t.length >= 2;) {
                                                let e = t[t.length - 1],
                                                    r = t[t.length - 2];
                                                if ((e.x - r.x) * (n.y - r.y) >= (e.y - r.y) * (n.x - r.x)) t.pop();
                                                else break
                                            }
                                            t.push(n)
                                        }
                                        t.pop();
                                        let r = [];
                                        for (let t = e.length - 1; t >= 0; t--) {
                                            let n = e[t];
                                            for (; r.length >= 2;) {
                                                let e = r[r.length - 1],
                                                    t = r[r.length - 2];
                                                if ((e.x - t.x) * (n.y - t.y) >= (e.y - t.y) * (n.x - t.x)) r.pop();
                                                else break
                                            }
                                            r.push(n)
                                        }
                                        return (r.pop(), 1 === t.length && 1 === r.length && t[0].x === r[0].x && t[0].y === r[0].y) ? t : t.concat(r)
                                    }(t)
                            }([... function(e, t) {
                                let r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 5,
                                    n = [];
                                switch (t) {
                                    case "top":
                                        n.push({
                                            x: e.x - r,
                                            y: e.y + r
                                        }, {
                                            x: e.x + r,
                                            y: e.y + r
                                        });
                                        break;
                                    case "bottom":
                                        n.push({
                                            x: e.x - r,
                                            y: e.y - r
                                        }, {
                                            x: e.x + r,
                                            y: e.y - r
                                        });
                                        break;
                                    case "left":
                                        n.push({
                                            x: e.x + r,
                                            y: e.y - r
                                        }, {
                                            x: e.x + r,
                                            y: e.y + r
                                        });
                                        break;
                                    case "right":
                                        n.push({
                                            x: e.x - r,
                                            y: e.y - r
                                        }, {
                                            x: e.x - r,
                                            y: e.y + r
                                        })
                                }
                                return n
                            }(n, o), ... function(e) {
                                let {
                                    top: t,
                                    right: r,
                                    bottom: n,
                                    left: o
                                } = e;
                                return [{
                                    x: o,
                                    y: t
                                }, {
                                    x: r,
                                    y: t
                                }, {
                                    x: r,
                                    y: n
                                }, {
                                    x: o,
                                    y: n
                                }]
                            }(t.getBoundingClientRect())])), p(!0)
                        }, [p]);
                    return n.useEffect(() => () => v(), [v]), n.useEffect(() => {
                        if (c && f) {
                            let e = e => g(e, f),
                                t = e => g(e, c);
                            return c.addEventListener("pointerleave", e), f.addEventListener("pointerleave", t), () => {
                                c.removeEventListener("pointerleave", e), f.removeEventListener("pointerleave", t)
                            }
                        }
                    }, [c, f, g, v]), n.useEffect(() => {
                        if (l) {
                            let e = e => {
                                let t = e.target,
                                    r = {
                                        x: e.clientX,
                                        y: e.clientY
                                    },
                                    n = (null == c ? void 0 : c.contains(t)) || (null == f ? void 0 : f.contains(t)),
                                    o = ! function(e, t) {
                                        let {
                                            x: r,
                                            y: n
                                        } = e, o = !1;
                                        for (let e = 0, i = t.length - 1; e < t.length; i = e++) {
                                            let a = t[e].x,
                                                u = t[e].y,
                                                l = t[i].x,
                                                s = t[i].y;
                                            u > n != s > n && r < (l - a) * (n - u) / (s - u) + a && (o = !o)
                                        }
                                        return o
                                    }(r, l);
                                n ? v() : o && (v(), d())
                            };
                            return document.addEventListener("pointermove", e), () => document.removeEventListener("pointermove", e)
                        }
                    }, [c, f, l, d, v]), (0, h.jsx)(Z, { ...e,
                        ref: u
                    })
                }),
                [I, F] = y(k, {
                    isInside: !1
                }),
                Z = n.forwardRef((e, t) => {
                    let {
                        __scopeTooltip: r,
                        children: o,
                        "aria-label": i,
                        onEscapeKeyDown: a,
                        onPointerDownOutside: l,
                        ...c
                    } = e, d = R(N, r), f = m(r), {
                        onClose: v
                    } = d;
                    return n.useEffect(() => (document.addEventListener(x, v), () => document.removeEventListener(x, v)), [v]), n.useEffect(() => {
                        if (d.trigger) {
                            let e = e => {
                                let t = e.target;
                                (null == t ? void 0 : t.contains(d.trigger)) && v()
                            };
                            return window.addEventListener("scroll", e, {
                                capture: !0
                            }), () => window.removeEventListener("scroll", e, {
                                capture: !0
                            })
                        }
                    }, [d.trigger, v]), (0, h.jsx)(u.XB, {
                        asChild: !0,
                        disableOutsidePointerEvents: !1,
                        onEscapeKeyDown: a,
                        onPointerDownOutside: l,
                        onFocusOutside: e => e.preventDefault(),
                        onDismiss: v,
                        children: (0, h.jsxs)(s.VY, {
                            "data-state": d.stateAttribute,
                            ...f,
                            ...c,
                            ref: t,
                            style: { ...c.style,
                                "--radix-tooltip-content-transform-origin": "var(--radix-popper-transform-origin)",
                                "--radix-tooltip-content-available-width": "var(--radix-popper-available-width)",
                                "--radix-tooltip-content-available-height": "var(--radix-popper-available-height)",
                                "--radix-tooltip-trigger-width": "var(--radix-popper-anchor-width)",
                                "--radix-tooltip-trigger-height": "var(--radix-popper-anchor-height)"
                            },
                            children: [(0, h.jsx)(p.A4, {
                                children: o
                            }), (0, h.jsx)(I, {
                                scope: r,
                                isInside: !0,
                                children: (0, h.jsx)(g, {
                                    id: d.contentId,
                                    role: "tooltip",
                                    children: i || o
                                })
                            })]
                        })
                    })
                });
            V.displayName = N;
            var W = "TooltipArrow";
            n.forwardRef((e, t) => {
                let {
                    __scopeTooltip: r,
                    ...n
                } = e, o = m(r);
                return F(W, r).isInside ? null : (0, h.jsx)(s.Eh, { ...o,
                    ...n,
                    ref: t
                })
            }).displayName = W;
            var z = C,
                q = T,
                $ = P,
                U = D,
                B = V
        },
        90413: function(e, t, r) {
            "use strict";
            r.d(t, {
                w_: function() {
                    return c
                }
            });
            var n = r(55185),
                o = {
                    color: void 0,
                    size: void 0,
                    className: void 0,
                    style: void 0,
                    attr: void 0
                },
                i = n.createContext && n.createContext(o),
                a = ["attr", "size", "title"];

            function u() {
                return (u = Object.assign ? Object.assign.bind() : function(e) {
                    for (var t = 1; t < arguments.length; t++) {
                        var r = arguments[t];
                        for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n])
                    }
                    return e
                }).apply(this, arguments)
            }

            function l(e, t) {
                var r = Object.keys(e);
                if (Object.getOwnPropertySymbols) {
                    var n = Object.getOwnPropertySymbols(e);
                    t && (n = n.filter(function(t) {
                        return Object.getOwnPropertyDescriptor(e, t).enumerable
                    })), r.push.apply(r, n)
                }
                return r
            }

            function s(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = null != arguments[t] ? arguments[t] : {};
                    t % 2 ? l(Object(r), !0).forEach(function(t) {
                        var n, o;
                        n = t, o = r[t], (n = function(e) {
                            var t = function(e, t) {
                                if ("object" != typeof e || !e) return e;
                                var r = e[Symbol.toPrimitive];
                                if (void 0 !== r) {
                                    var n = r.call(e, t || "default");
                                    if ("object" != typeof n) return n;
                                    throw TypeError("@@toPrimitive must return a primitive value.")
                                }
                                return ("string" === t ? String : Number)(e)
                            }(e, "string");
                            return "symbol" == typeof t ? t : t + ""
                        }(n)) in e ? Object.defineProperty(e, n, {
                            value: o,
                            enumerable: !0,
                            configurable: !0,
                            writable: !0
                        }) : e[n] = o
                    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : l(Object(r)).forEach(function(t) {
                        Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(r, t))
                    })
                }
                return e
            }

            function c(e) {
                return t => n.createElement(d, u({
                    attr: s({}, e.attr)
                }, t), function e(t) {
                    return t && t.map((t, r) => n.createElement(t.tag, s({
                        key: r
                    }, t.attr), e(t.child)))
                }(e.child))
            }

            function d(e) {
                var t = t => {
                    var r, {
                            attr: o,
                            size: i,
                            title: l
                        } = e,
                        c = function(e, t) {
                            if (null == e) return {};
                            var r, n, o = function(e, t) {
                                if (null == e) return {};
                                var r = {};
                                for (var n in e)
                                    if (Object.prototype.hasOwnProperty.call(e, n)) {
                                        if (t.indexOf(n) >= 0) continue;
                                        r[n] = e[n]
                                    }
                                return r
                            }(e, t);
                            if (Object.getOwnPropertySymbols) {
                                var i = Object.getOwnPropertySymbols(e);
                                for (n = 0; n < i.length; n++) r = i[n], !(t.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(e, r) && (o[r] = e[r])
                            }
                            return o
                        }(e, a),
                        d = i || t.size || "1em";
                    return t.className && (r = t.className), e.className && (r = (r ? r + " " : "") + e.className), n.createElement("svg", u({
                        stroke: "currentColor",
                        fill: "currentColor",
                        strokeWidth: "0"
                    }, t.attr, o, c, {
                        className: r,
                        style: s(s({
                            color: e.color || t.color
                        }, t.style), e.style),
                        height: d,
                        width: d,
                        xmlns: "http://www.w3.org/2000/svg"
                    }), l && n.createElement("title", null, l), e.children)
                };
                return void 0 !== i ? n.createElement(i.Consumer, null, e => t(e)) : t(o)
            }
        },
        77755: function(e, t, r) {
            "use strict";
            r.d(t, {
                $l: function() {
                    return a
                },
                BN: function() {
                    return V
                },
                DY: function() {
                    return v
                },
                Fs: function() {
                    return F
                },
                J$: function() {
                    return $
                },
                JN: function() {
                    return x
                },
                LI: function() {
                    return _
                },
                PM: function() {
                    return s
                },
                UG: function() {
                    return U
                },
                W6: function() {
                    return R
                },
                i_: function() {
                    return i
                },
                ko: function() {
                    return K
                },
                kw: function() {
                    return T
                },
                mf: function() {
                    return l
                },
                o8: function() {
                    return u
                },
                qC: function() {
                    return L
                },
                s6: function() {
                    return G
                },
                sj: function() {
                    return N
                },
                u3: function() {
                    return D
                },
                u_: function() {
                    return W
                },
                w6: function() {
                    return j
                },
                xD: function() {
                    return Q
                }
            });
            var n = r(55185);
            let o = () => {},
                i = o(),
                a = Object,
                u = e => e === i,
                l = e => "function" == typeof e,
                s = (e, t) => ({ ...e,
                    ...t
                }),
                c = e => l(e.then),
                d = new WeakMap,
                f = 0,
                p = e => {
                    let t, r;
                    let n = typeof e,
                        o = e && e.constructor,
                        i = o == Date;
                    if (a(e) !== e || i || o == RegExp) t = i ? e.toJSON() : "symbol" == n ? e.toString() : "string" == n ? JSON.stringify(e) : "" + e;
                    else {
                        if (t = d.get(e)) return t;
                        if (t = ++f + "~", d.set(e, t), o == Array) {
                            for (r = 0, t = "@"; r < e.length; r++) t += p(e[r]) + ",";
                            d.set(e, t)
                        }
                        if (o == a) {
                            t = "#";
                            let n = a.keys(e).sort();
                            for (; !u(r = n.pop());) u(e[r]) || (t += r + ":" + p(e[r]) + ",");
                            d.set(e, t)
                        }
                    }
                    return t
                },
                v = new WeakMap,
                h = {},
                g = {},
                y = "undefined",
                w = typeof window != y,
                m = typeof document != y,
                b = () => w && typeof window.requestAnimationFrame != y,
                x = (e, t) => {
                    let r = v.get(e);
                    return [() => !u(t) && e.get(t) || h, n => {
                        if (!u(t)) {
                            let o = e.get(t);
                            t in g || (g[t] = o), r[5](t, s(o, n), o || h)
                        }
                    }, r[6], () => !u(t) && t in g ? g[t] : !u(t) && e.get(t) || h]
                },
                E = !0,
                [O, C] = w && window.addEventListener ? [window.addEventListener.bind(window), window.removeEventListener.bind(window)] : [o, o],
                k = {
                    initFocus: e => (m && document.addEventListener("visibilitychange", e), O("focus", e), () => {
                        m && document.removeEventListener("visibilitychange", e), C("focus", e)
                    }),
                    initReconnect: e => {
                        let t = () => {
                                E = !0, e()
                            },
                            r = () => {
                                E = !1
                            };
                        return O("online", t), O("offline", r), () => {
                            C("online", t), C("offline", r)
                        }
                    }
                },
                j = !n.useId,
                R = !w || "Deno" in window,
                T = e => b() ? window.requestAnimationFrame(e) : setTimeout(e, 1),
                _ = R ? n.useEffect : n.useLayoutEffect,
                P = "undefined" != typeof navigator && navigator.connection,
                M = !R && P && (["slow-2g", "2g"].includes(P.effectiveType) || P.saveData),
                L = e => {
                    if (l(e)) try {
                        e = e()
                    } catch (t) {
                        e = ""
                    }
                    let t = e;
                    return [e = "string" == typeof e ? e : (Array.isArray(e) ? e.length : e) ? p(e) : "", t]
                },
                S = 0,
                D = () => ++S;
            var N = {
                __proto__: null,
                ERROR_REVALIDATE_EVENT: 3,
                FOCUS_EVENT: 0,
                MUTATE_EVENT: 2,
                RECONNECT_EVENT: 1
            };
            async function V(...e) {
                let [t, r, n, o] = e, a = s({
                    populateCache: !0,
                    throwOnError: !0
                }, "boolean" == typeof o ? {
                    revalidate: o
                } : o || {}), d = a.populateCache, f = a.rollbackOnError, p = a.optimisticData, h = e => "function" == typeof f ? f(e) : !1 !== f, g = a.throwOnError;
                if (l(r)) {
                    let e = [];
                    for (let n of t.keys()) !/^\$(inf|sub)\$/.test(n) && r(t.get(n)._k) && e.push(n);
                    return Promise.all(e.map(y))
                }
                return y(r);
                async function y(r) {
                    let o;
                    let [s] = L(r);
                    if (!s) return;
                    let [f, y] = x(t, s), [w, m, b, E] = v.get(t), O = () => {
                        let e = w[s];
                        return (l(a.revalidate) ? a.revalidate(f().data, r) : !1 !== a.revalidate) && (delete b[s], delete E[s], e && e[0]) ? e[0](2).then(() => f().data) : f().data
                    };
                    if (e.length < 3) return O();
                    let C = n,
                        k = D();
                    m[s] = [k, 0];
                    let j = !u(p),
                        R = f(),
                        T = R.data,
                        _ = R._c,
                        P = u(_) ? T : _;
                    if (j && y({
                            data: p = l(p) ? p(P, T) : p,
                            _c: P
                        }), l(C)) try {
                        C = C(P)
                    } catch (e) {
                        o = e
                    }
                    if (C && c(C)) {
                        if (C = await C.catch(e => {
                                o = e
                            }), k !== m[s][0]) {
                            if (o) throw o;
                            return C
                        }
                        o && j && h(o) && (d = !0, y({
                            data: P,
                            _c: i
                        }))
                    }
                    if (d && !o && (l(d) ? y({
                            data: d(C, P),
                            error: i,
                            _c: i
                        }) : y({
                            data: C,
                            error: i,
                            _c: i
                        })), m[s][1] = D(), Promise.resolve(O()).then(() => {
                            y({
                                _c: i
                            })
                        }), o) {
                        if (g) throw o;
                        return
                    }
                    return C
                }
            }
            let A = (e, t) => {
                    for (let r in e) e[r][0] && e[r][0](t)
                },
                I = (e, t) => {
                    if (!v.has(e)) {
                        let r = s(k, t),
                            n = {},
                            a = V.bind(i, e),
                            u = o,
                            l = {},
                            c = (e, t) => {
                                let r = l[e] || [];
                                return l[e] = r, r.push(t), () => r.splice(r.indexOf(t), 1)
                            },
                            d = (t, r, n) => {
                                e.set(t, r);
                                let o = l[t];
                                if (o)
                                    for (let e of o) e(r, n)
                            },
                            f = () => {
                                if (!v.has(e) && (v.set(e, [n, {}, {}, {}, a, d, c]), !R)) {
                                    let t = r.initFocus(setTimeout.bind(i, A.bind(i, n, 0))),
                                        o = r.initReconnect(setTimeout.bind(i, A.bind(i, n, 1)));
                                    u = () => {
                                        t && t(), o && o(), v.delete(e)
                                    }
                                }
                            };
                        return f(), [e, a, f, u]
                    }
                    return [e, v.get(e)[4]]
                },
                [F, Z] = I(new Map),
                W = s({
                    onLoadingSlow: o,
                    onSuccess: o,
                    onError: o,
                    onErrorRetry: (e, t, r, n, o) => {
                        let i = r.errorRetryCount,
                            a = o.retryCount,
                            l = ~~((Math.random() + .5) * (1 << (a < 8 ? a : 8))) * r.errorRetryInterval;
                        (u(i) || !(a > i)) && setTimeout(n, l, o)
                    },
                    onDiscarded: o,
                    revalidateOnFocus: !0,
                    revalidateOnReconnect: !0,
                    revalidateIfStale: !0,
                    shouldRetryOnError: !0,
                    errorRetryInterval: M ? 1e4 : 5e3,
                    focusThrottleInterval: 5e3,
                    dedupingInterval: 2e3,
                    loadingTimeout: M ? 5e3 : 3e3,
                    compare: (e, t) => p(e) == p(t),
                    isPaused: () => !1,
                    cache: F,
                    mutate: Z,
                    fallback: {}
                }, {
                    isOnline: () => E,
                    isVisible: () => {
                        let e = m && document.visibilityState;
                        return u(e) || "hidden" !== e
                    }
                }),
                z = (e, t) => {
                    let r = s(e, t);
                    if (t) {
                        let {
                            use: n,
                            fallback: o
                        } = e, {
                            use: i,
                            fallback: a
                        } = t;
                        n && i && (r.use = n.concat(i)), o && a && (r.fallback = s(o, a))
                    }
                    return r
                },
                q = (0, n.createContext)({}),
                $ = e => {
                    let {
                        value: t
                    } = e, r = (0, n.useContext)(q), o = l(t), a = (0, n.useMemo)(() => o ? t(r) : t, [o, r, t]), u = (0, n.useMemo)(() => o ? a : z(r, a), [o, r, a]), c = a && a.provider, d = (0, n.useRef)(i);
                    c && !d.current && (d.current = I(c(u.cache || F), a));
                    let f = d.current;
                    return f && (u.cache = f[0], u.mutate = f[1]), _(() => {
                        if (f) return f[2] && f[2](), f[3]
                    }, []), (0, n.createElement)(q.Provider, s(e, {
                        value: u
                    }))
                },
                U = "$inf$",
                B = w && window.__SWR_DEVTOOLS_USE__,
                Y = B ? window.__SWR_DEVTOOLS_USE__ : [],
                H = e => l(e[1]) ? [e[0], e[1], e[2] || {}] : [e[0], null, (null === e[1] ? e[2] : e[1]) || {}],
                J = () => s(W, (0, n.useContext)(q)),
                X = Y.concat(e => (t, r, n) => {
                    let o = r && ((...e) => {
                        let [n] = L(t), [, , , o] = v.get(F);
                        if (n.startsWith(U)) return r(...e);
                        let i = o[n];
                        return u(i) ? r(...e) : (delete o[n], i)
                    });
                    return e(t, o, n)
                }),
                G = e => function(...t) {
                    let r = J(),
                        [n, o, i] = H(t),
                        a = z(r, i),
                        u = e,
                        {
                            use: l
                        } = a,
                        s = (l || []).concat(X);
                    for (let e = s.length; e--;) u = s[e](u);
                    return u(n, o || a.fetcher || null, a)
                },
                K = (e, t, r) => {
                    let n = t[e] || (t[e] = []);
                    return n.push(r), () => {
                        let e = n.indexOf(r);
                        e >= 0 && (n[e] = n[n.length - 1], n.pop())
                    }
                },
                Q = (e, t) => (...r) => {
                    let [n, o, i] = H(r), a = (i.use || []).concat(t);
                    return e(n, o, { ...i,
                        use: a
                    })
                };
            B && (window.__SWR_DEVTOOLS_REACT__ = n)
        },
        47898: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return s
                }
            });
            var n = r(55185),
                o = r(3752),
                i = r(77755);
            let a = n.use || (e => {
                    if ("pending" === e.status) throw e;
                    if ("fulfilled" === e.status) return e.value;
                    if ("rejected" === e.status) throw e.reason;
                    throw e.status = "pending", e.then(t => {
                        e.status = "fulfilled", e.value = t
                    }, t => {
                        e.status = "rejected", e.reason = t
                    }), e
                }),
                u = {
                    dedupe: !0
                };
            i.$l.defineProperty(i.J$, "defaultValue", {
                value: i.u_
            });
            let l = (0, i.s6)((e, t, r) => {
                    let {
                        cache: l,
                        compare: s,
                        suspense: c,
                        fallbackData: d,
                        revalidateOnMount: f,
                        revalidateIfStale: p,
                        refreshInterval: v,
                        refreshWhenHidden: h,
                        refreshWhenOffline: g,
                        keepPreviousData: y
                    } = r, [w, m, b, x] = i.DY.get(l), [E, O] = (0, i.qC)(e), C = (0, n.useRef)(!1), k = (0, n.useRef)(!1), j = (0, n.useRef)(E), R = (0, n.useRef)(t), T = (0, n.useRef)(r), _ = () => T.current, P = () => _().isVisible() && _().isOnline(), [M, L, S, D] = (0, i.JN)(l, E), N = (0, n.useRef)({}).current, V = (0, i.o8)(d) ? r.fallback[E] : d, A = (e, t) => {
                        for (let r in N)
                            if ("data" === r) {
                                if (!s(e[r], t[r]) && (!(0, i.o8)(e[r]) || !s(B, t[r]))) return !1
                            } else if (t[r] !== e[r]) return !1;
                        return !0
                    }, I = (0, n.useMemo)(() => {
                        let e = !!E && !!t && ((0, i.o8)(f) ? !_().isPaused() && !c && (!!(0, i.o8)(p) || p) : f),
                            r = t => {
                                let r = (0, i.PM)(t);
                                return (delete r._k, e) ? {
                                    isValidating: !0,
                                    isLoading: !0,
                                    ...r
                                } : r
                            },
                            n = M(),
                            o = D(),
                            a = r(n),
                            u = n === o ? a : r(o),
                            l = a;
                        return [() => {
                            let e = r(M());
                            return A(e, l) ? (l.data = e.data, l.isLoading = e.isLoading, l.isValidating = e.isValidating, l.error = e.error, l) : (l = e, e)
                        }, () => u]
                    }, [l, E]), F = (0, o.useSyncExternalStore)((0, n.useCallback)(e => S(E, (t, r) => {
                        A(r, t) || e()
                    }), [l, E]), I[0], I[1]), Z = !C.current, W = w[E] && w[E].length > 0, z = F.data, q = (0, i.o8)(z) ? V : z, $ = F.error, U = (0, n.useRef)(q), B = y ? (0, i.o8)(z) ? U.current : z : q, Y = (!W || !!(0, i.o8)($)) && (Z && !(0, i.o8)(f) ? f : !_().isPaused() && (c ? !(0, i.o8)(q) && p : (0, i.o8)(q) || p)), H = !!(E && t && Z && Y), J = (0, i.o8)(F.isValidating) ? H : F.isValidating, X = (0, i.o8)(F.isLoading) ? H : F.isLoading, G = (0, n.useCallback)(async e => {
                        let t, n;
                        let o = R.current;
                        if (!E || !o || k.current || _().isPaused()) return !1;
                        let a = !0,
                            u = e || {},
                            l = !b[E] || !u.dedupe,
                            c = () => i.w6 ? !k.current && E === j.current && C.current : E === j.current,
                            d = {
                                isValidating: !1,
                                isLoading: !1
                            },
                            f = () => {
                                L(d)
                            },
                            p = () => {
                                let e = b[E];
                                e && e[1] === n && delete b[E]
                            },
                            v = {
                                isValidating: !0
                            };
                        (0, i.o8)(M().data) && (v.isLoading = !0);
                        try {
                            if (l && (L(v), r.loadingTimeout && (0, i.o8)(M().data) && setTimeout(() => {
                                    a && c() && _().onLoadingSlow(E, r)
                                }, r.loadingTimeout), b[E] = [o(O), (0, i.u3)()]), [t, n] = b[E], t = await t, l && setTimeout(p, r.dedupingInterval), !b[E] || b[E][1] !== n) return l && c() && _().onDiscarded(E), !1;
                            d.error = i.i_;
                            let e = m[E];
                            if (!(0, i.o8)(e) && (n <= e[0] || n <= e[1] || 0 === e[1])) return f(), l && c() && _().onDiscarded(E), !1;
                            let u = M().data;
                            d.data = s(u, t) ? u : t, l && c() && _().onSuccess(t, E, r)
                        } catch (r) {
                            p();
                            let e = _(),
                                {
                                    shouldRetryOnError: t
                                } = e;
                            !e.isPaused() && (d.error = r, l && c() && (e.onError(r, E, e), (!0 === t || (0, i.mf)(t) && t(r)) && (!_().revalidateOnFocus || !_().revalidateOnReconnect || P()) && e.onErrorRetry(r, E, e, e => {
                                let t = w[E];
                                t && t[0] && t[0](i.sj.ERROR_REVALIDATE_EVENT, e)
                            }, {
                                retryCount: (u.retryCount || 0) + 1,
                                dedupe: !0
                            })))
                        }
                        return a = !1, f(), !0
                    }, [E, l]), K = (0, n.useCallback)((...e) => (0, i.BN)(l, j.current, ...e), []);
                    if ((0, i.LI)(() => {
                            R.current = t, T.current = r, (0, i.o8)(z) || (U.current = z)
                        }), (0, i.LI)(() => {
                            if (!E) return;
                            let e = G.bind(i.i_, u),
                                t = 0,
                                r = (0, i.ko)(E, w, (r, n = {}) => {
                                    if (r == i.sj.FOCUS_EVENT) {
                                        let r = Date.now();
                                        _().revalidateOnFocus && r > t && P() && (t = r + _().focusThrottleInterval, e())
                                    } else if (r == i.sj.RECONNECT_EVENT) _().revalidateOnReconnect && P() && e();
                                    else if (r == i.sj.MUTATE_EVENT) return G();
                                    else if (r == i.sj.ERROR_REVALIDATE_EVENT) return G(n)
                                });
                            return k.current = !1, j.current = E, C.current = !0, L({
                                _k: O
                            }), Y && ((0, i.o8)(q) || i.W6 ? e() : (0, i.kw)(e)), () => {
                                k.current = !0, r()
                            }
                        }, [E]), (0, i.LI)(() => {
                            let e;

                            function t() {
                                let t = (0, i.mf)(v) ? v(M().data) : v;
                                t && -1 !== e && (e = setTimeout(r, t))
                            }

                            function r() {
                                !M().error && (h || _().isVisible()) && (g || _().isOnline()) ? G(u).then(t) : t()
                            }
                            return t(), () => {
                                e && (clearTimeout(e), e = -1)
                            }
                        }, [v, h, g, E]), (0, n.useDebugValue)(B), c && (0, i.o8)(q) && E) {
                        if (!i.w6 && i.W6) throw Error("Fallback data is required when using suspense in SSR.");
                        R.current = t, T.current = r, k.current = !1;
                        let e = x[E];
                        if ((0, i.o8)(e) || a(K(e)), (0, i.o8)($)) {
                            let e = G(u);
                            (0, i.o8)(B) || (e.status = "fulfilled", e.value = !0), a(e)
                        } else throw $
                    }
                    return {
                        mutate: K,
                        get data() {
                            return N.data = !0, B
                        },
                        get error() {
                            return N.error = !0, $
                        },
                        get isValidating() {
                            return N.isValidating = !0, J
                        },
                        get isLoading() {
                            return N.isLoading = !0, X
                        }
                    }
                }),
                s = (0, i.xD)(l, e => (t, r, n) => (n.revalidateOnFocus = !1, n.revalidateIfStale = !1, n.revalidateOnReconnect = !1, e(t, r, n)))
        },
        2982: function(e, t, r) {
            "use strict";
            r.d(t, {
                $0: function() {
                    return a
                },
                OR: function() {
                    return i
                }
            });
            var n = r(55185);
            r(5670);
            var o = "undefined" != typeof window ? n.useLayoutEffect : n.useEffect;

            function i(e, t, r, i) {
                let a = (0, n.useRef)(t);
                o(() => {
                    a.current = t
                }, [t]), (0, n.useEffect)(() => {
                    let t = (null == r ? void 0 : r.current) ? ? window;
                    if (!(t && t.addEventListener)) return;
                    let n = e => {
                        a.current(e)
                    };
                    return t.addEventListener(e, n, i), () => {
                        t.removeEventListener(e, n, i)
                    }
                }, [e, r, i])
            }

            function a(e) {
                let t = (0, n.useRef)(() => {
                    throw Error("Cannot call an event handler while rendering.")
                });
                return o(() => {
                    t.current = e
                }, [e]), (0, n.useCallback)((...e) => {
                    var r;
                    return null == (r = t.current) ? void 0 : r.call(t, ...e)
                }, [t])
            }
        }
    }
]);