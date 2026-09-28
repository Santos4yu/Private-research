(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [3757], {
        83340: function(e, t, r) {
            var n = r(75593).Symbol;
            e.exports = n
        },
        36595: function(e, t, r) {
            var n = r(83340),
                a = r(51462),
                l = r(78270),
                o = n ? n.toStringTag : void 0;
            e.exports = function(e) {
                return null == e ? void 0 === e ? "[object Undefined]" : "[object Null]" : o && o in Object(e) ? a(e) : l(e)
            }
        },
        9270: function(e, t, r) {
            var n = r(60289),
                a = /^\s+/;
            e.exports = function(e) {
                return e ? e.slice(0, n(e) + 1).replace(a, "") : e
            }
        },
        91199: function(e, t, r) {
            var n = "object" == typeof r.g && r.g && r.g.Object === Object && r.g;
            e.exports = n
        },
        51462: function(e, t, r) {
            var n = r(83340),
                a = Object.prototype,
                l = a.hasOwnProperty,
                o = a.toString,
                f = n ? n.toStringTag : void 0;
            e.exports = function(e) {
                var t = l.call(e, f),
                    r = e[f];
                try {
                    e[f] = void 0;
                    var n = !0
                } catch (e) {}
                var a = o.call(e);
                return n && (t ? e[f] = r : delete e[f]), a
            }
        },
        78270: function(e) {
            var t = Object.prototype.toString;
            e.exports = function(e) {
                return t.call(e)
            }
        },
        75593: function(e, t, r) {
            var n = r(91199),
                a = "object" == typeof self && self && self.Object === Object && self,
                l = n || a || Function("return this")();
            e.exports = l
        },
        60289: function(e) {
            var t = /\s/;
            e.exports = function(e) {
                for (var r = e.length; r-- && t.test(e.charAt(r)););
                return r
            }
        },
        34586: function(e, t, r) {
            var n = r(58546),
                a = r(13664),
                l = r(71622),
                o = Math.max,
                f = Math.min;
            e.exports = function(e, t, r) {
                var i, u, s, c, d, h, b = 0,
                    g = !1,
                    p = !1,
                    m = !0;
                if ("function" != typeof e) throw TypeError("Expected a function");

                function y(t) {
                    var r = i,
                        n = u;
                    return i = u = void 0, b = t, c = e.apply(n, r)
                }

                function v(e) {
                    var r = e - h,
                        n = e - b;
                    return void 0 === h || r >= t || r < 0 || p && n >= s
                }

                function w() {
                    var e, r, n, l = a();
                    if (v(l)) return k(l);
                    d = setTimeout(w, (e = l - h, r = l - b, n = t - e, p ? f(n, s - r) : n))
                }

                function k(e) {
                    return (d = void 0, m && i) ? y(e) : (i = u = void 0, c)
                }

                function x() {
                    var e, r = a(),
                        n = v(r);
                    if (i = arguments, u = this, h = r, n) {
                        if (void 0 === d) return b = e = h, d = setTimeout(w, t), g ? y(e) : c;
                        if (p) return clearTimeout(d), d = setTimeout(w, t), y(h)
                    }
                    return void 0 === d && (d = setTimeout(w, t)), c
                }
                return t = l(t) || 0, n(r) && (g = !!r.leading, s = (p = "maxWait" in r) ? o(l(r.maxWait) || 0, t) : s, m = "trailing" in r ? !!r.trailing : m), x.cancel = function() {
                    void 0 !== d && clearTimeout(d), b = 0, i = h = u = d = void 0
                }, x.flush = function() {
                    return void 0 === d ? c : k(a())
                }, x
            }
        },
        58546: function(e) {
            e.exports = function(e) {
                var t = typeof e;
                return null != e && ("object" == t || "function" == t)
            }
        },
        42997: function(e) {
            e.exports = function(e) {
                return null != e && "object" == typeof e
            }
        },
        53573: function(e, t, r) {
            var n = r(36595),
                a = r(42997);
            e.exports = function(e) {
                return "symbol" == typeof e || a(e) && "[object Symbol]" == n(e)
            }
        },
        13664: function(e, t, r) {
            var n = r(75593);
            e.exports = function() {
                return n.Date.now()
            }
        },
        71622: function(e, t, r) {
            var n = r(9270),
                a = r(58546),
                l = r(53573),
                o = 0 / 0,
                f = /^[-+]0x[0-9a-f]+$/i,
                i = /^0b[01]+$/i,
                u = /^0o[0-7]+$/i,
                s = parseInt;
            e.exports = function(e) {
                if ("number" == typeof e) return e;
                if (l(e)) return o;
                if (a(e)) {
                    var t = "function" == typeof e.valueOf ? e.valueOf() : e;
                    e = a(t) ? t + "" : t
                }
                if ("string" != typeof e) return 0 === e ? e : +e;
                e = n(e);
                var r = i.test(e);
                return r || u.test(e) ? s(e.slice(2), r ? 2 : 8) : f.test(e) ? o : +e
            }
        },
        16150: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("ListOrdered", [
                ["line", {
                    x1: "10",
                    x2: "21",
                    y1: "6",
                    y2: "6",
                    key: "76qw6h"
                }],
                ["line", {
                    x1: "10",
                    x2: "21",
                    y1: "12",
                    y2: "12",
                    key: "16nom4"
                }],
                ["line", {
                    x1: "10",
                    x2: "21",
                    y1: "18",
                    y2: "18",
                    key: "u3jurt"
                }],
                ["path", {
                    d: "M4 6h1v4",
                    key: "cnovpq"
                }],
                ["path", {
                    d: "M4 10h2",
                    key: "16xx2s"
                }],
                ["path", {
                    d: "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",
                    key: "m9a95d"
                }]
            ])
        },
        39094: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return n
                }
            });
            let n = (0, r(76188).Z)("Shield", [
                ["path", {
                    d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
                    key: "oel41y"
                }]
            ])
        },
        34707: function(e, t, r) {
            "use strict";
            r.d(t, {
                bU: function() {
                    return U
                },
                e6: function() {
                    return z
                },
                fC: function() {
                    return G
                },
                fQ: function() {
                    return Y
                }
            });
            var n = r(55185),
                a = r(66983),
                l = r(4142),
                o = r(46121),
                f = r(70358),
                i = r(63485),
                u = r(36086),
                s = r(34001),
                c = r(815),
                d = r(56366),
                h = r(84007),
                b = r(10131),
                g = ["PageUp", "PageDown"],
                p = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
                m = {
                    "from-left": ["Home", "PageDown", "ArrowDown", "ArrowLeft"],
                    "from-right": ["Home", "PageDown", "ArrowDown", "ArrowRight"],
                    "from-bottom": ["Home", "PageDown", "ArrowDown", "ArrowLeft"],
                    "from-top": ["Home", "PageDown", "ArrowUp", "ArrowLeft"]
                },
                y = "Slider",
                [v, w, k] = (0, h.B)(y),
                [x, _] = (0, f.b)(y, [k]),
                [M, N] = x(y),
                E = n.forwardRef((e, t) => {
                    let {
                        name: r,
                        min: o = 0,
                        max: f = 100,
                        step: u = 1,
                        orientation: s = "horizontal",
                        disabled: c = !1,
                        minStepsBetweenThumbs: d = 0,
                        defaultValue: h = [o],
                        value: m,
                        onValueChange: y = () => {},
                        onValueCommit: w = () => {},
                        inverted: k = !1,
                        ...x
                    } = e, _ = n.useRef(new Set), N = n.useRef(0), E = "horizontal" === s ? R : A, [j = [], S] = (0, i.T)({
                        prop: m,
                        defaultProp: h,
                        onChange: e => {
                            var t;
                            null === (t = [..._.current][N.current]) || void 0 === t || t.focus(), y(e)
                        }
                    }), P = n.useRef(j);

                    function O(e, t) {
                        let {
                            commit: r
                        } = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {
                            commit: !1
                        }, n = (String(u).split(".")[1] || "").length, l = function(e, t) {
                            let r = Math.pow(10, t);
                            return Math.round(e * r) / r
                        }(Math.round((e - o) / u) * u + o, n), i = (0, a.u)(l, [o, f]);
                        S(function() {
                            var e, n;
                            let a = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [],
                                l = function() {
                                    let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [],
                                        t = arguments.length > 1 ? arguments[1] : void 0,
                                        r = arguments.length > 2 ? arguments[2] : void 0,
                                        n = [...e];
                                    return n[r] = t, n.sort((e, t) => e - t)
                                }(a, i, t);
                            if (e = l, !(!((n = d * u) > 0) || Math.min(...e.slice(0, -1).map((t, r) => e[r + 1] - t)) >= n)) return a; {
                                N.current = l.indexOf(i);
                                let e = String(l) !== String(a);
                                return e && r && w(l), e ? l : a
                            }
                        })
                    }
                    return (0, b.jsx)(M, {
                        scope: e.__scopeSlider,
                        name: r,
                        disabled: c,
                        min: o,
                        max: f,
                        valueIndexToChangeRef: N,
                        thumbs: _.current,
                        values: j,
                        orientation: s,
                        children: (0, b.jsx)(v.Provider, {
                            scope: e.__scopeSlider,
                            children: (0, b.jsx)(v.Slot, {
                                scope: e.__scopeSlider,
                                children: (0, b.jsx)(E, {
                                    "aria-disabled": c,
                                    "data-disabled": c ? "" : void 0,
                                    ...x,
                                    ref: t,
                                    onPointerDown: (0, l.M)(x.onPointerDown, () => {
                                        c || (P.current = j)
                                    }),
                                    min: o,
                                    max: f,
                                    inverted: k,
                                    onSlideStart: c ? void 0 : function(e) {
                                        let t = function(e, t) {
                                            if (1 === e.length) return 0;
                                            let r = e.map(e => Math.abs(e - t));
                                            return r.indexOf(Math.min(...r))
                                        }(j, e);
                                        O(e, t)
                                    },
                                    onSlideMove: c ? void 0 : function(e) {
                                        O(e, N.current)
                                    },
                                    onSlideEnd: c ? void 0 : function() {
                                        let e = P.current[N.current];
                                        j[N.current] !== e && w(j)
                                    },
                                    onHomeKeyDown: () => !c && O(o, 0, {
                                        commit: !0
                                    }),
                                    onEndKeyDown: () => !c && O(f, j.length - 1, {
                                        commit: !0
                                    }),
                                    onStepKeyDown: e => {
                                        let {
                                            event: t,
                                            direction: r
                                        } = e;
                                        if (!c) {
                                            let e = g.includes(t.key) || t.shiftKey && p.includes(t.key),
                                                n = N.current;
                                            O(j[n] + u * (e ? 10 : 1) * r, n, {
                                                commit: !0
                                            })
                                        }
                                    }
                                })
                            })
                        })
                    })
                });
            E.displayName = y;
            var [j, S] = x(y, {
                startEdge: "left",
                endEdge: "right",
                size: "width",
                direction: 1
            }), R = n.forwardRef((e, t) => {
                let {
                    min: r,
                    max: a,
                    dir: l,
                    inverted: f,
                    onSlideStart: i,
                    onSlideMove: s,
                    onSlideEnd: c,
                    onStepKeyDown: d,
                    ...h
                } = e, [g, p] = n.useState(null), y = (0, o.e)(t, e => p(e)), v = n.useRef(), w = (0, u.gm)(l), k = "ltr" === w, x = k && !f || !k && f;

                function _(e) {
                    let t = v.current || g.getBoundingClientRect(),
                        n = B([0, t.width], x ? [r, a] : [a, r]);
                    return v.current = t, n(e - t.left)
                }
                return (0, b.jsx)(j, {
                    scope: e.__scopeSlider,
                    startEdge: x ? "left" : "right",
                    endEdge: x ? "right" : "left",
                    direction: x ? 1 : -1,
                    size: "width",
                    children: (0, b.jsx)(P, {
                        dir: w,
                        "data-orientation": "horizontal",
                        ...h,
                        ref: y,
                        style: { ...h.style,
                            "--radix-slider-thumb-transform": "translateX(-50%)"
                        },
                        onSlideStart: e => {
                            let t = _(e.clientX);
                            null == i || i(t)
                        },
                        onSlideMove: e => {
                            let t = _(e.clientX);
                            null == s || s(t)
                        },
                        onSlideEnd: () => {
                            v.current = void 0, null == c || c()
                        },
                        onStepKeyDown: e => {
                            let t = m[x ? "from-left" : "from-right"].includes(e.key);
                            null == d || d({
                                event: e,
                                direction: t ? -1 : 1
                            })
                        }
                    })
                })
            }), A = n.forwardRef((e, t) => {
                let {
                    min: r,
                    max: a,
                    inverted: l,
                    onSlideStart: f,
                    onSlideMove: i,
                    onSlideEnd: u,
                    onStepKeyDown: s,
                    ...c
                } = e, d = n.useRef(null), h = (0, o.e)(t, d), g = n.useRef(), p = !l;

                function y(e) {
                    let t = g.current || d.current.getBoundingClientRect(),
                        n = B([0, t.height], p ? [a, r] : [r, a]);
                    return g.current = t, n(e - t.top)
                }
                return (0, b.jsx)(j, {
                    scope: e.__scopeSlider,
                    startEdge: p ? "bottom" : "top",
                    endEdge: p ? "top" : "bottom",
                    size: "height",
                    direction: p ? 1 : -1,
                    children: (0, b.jsx)(P, {
                        "data-orientation": "vertical",
                        ...c,
                        ref: h,
                        style: { ...c.style,
                            "--radix-slider-thumb-transform": "translateY(50%)"
                        },
                        onSlideStart: e => {
                            let t = y(e.clientY);
                            null == f || f(t)
                        },
                        onSlideMove: e => {
                            let t = y(e.clientY);
                            null == i || i(t)
                        },
                        onSlideEnd: () => {
                            g.current = void 0, null == u || u()
                        },
                        onStepKeyDown: e => {
                            let t = m[p ? "from-bottom" : "from-top"].includes(e.key);
                            null == s || s({
                                event: e,
                                direction: t ? -1 : 1
                            })
                        }
                    })
                })
            }), P = n.forwardRef((e, t) => {
                let {
                    __scopeSlider: r,
                    onSlideStart: n,
                    onSlideMove: a,
                    onSlideEnd: o,
                    onHomeKeyDown: f,
                    onEndKeyDown: i,
                    onStepKeyDown: u,
                    ...s
                } = e, c = N(y, r);
                return (0, b.jsx)(d.WV.span, { ...s,
                    ref: t,
                    onKeyDown: (0, l.M)(e.onKeyDown, e => {
                        "Home" === e.key ? (f(e), e.preventDefault()) : "End" === e.key ? (i(e), e.preventDefault()) : g.concat(p).includes(e.key) && (u(e), e.preventDefault())
                    }),
                    onPointerDown: (0, l.M)(e.onPointerDown, e => {
                        let t = e.target;
                        t.setPointerCapture(e.pointerId), e.preventDefault(), c.thumbs.has(t) ? t.focus() : n(e)
                    }),
                    onPointerMove: (0, l.M)(e.onPointerMove, e => {
                        e.target.hasPointerCapture(e.pointerId) && a(e)
                    }),
                    onPointerUp: (0, l.M)(e.onPointerUp, e => {
                        let t = e.target;
                        t.hasPointerCapture(e.pointerId) && (t.releasePointerCapture(e.pointerId), o(e))
                    })
                })
            }), O = "SliderTrack", L = n.forwardRef((e, t) => {
                let {
                    __scopeSlider: r,
                    ...n
                } = e, a = N(O, r);
                return (0, b.jsx)(d.WV.span, {
                    "data-disabled": a.disabled ? "" : void 0,
                    "data-orientation": a.orientation,
                    ...n,
                    ref: t
                })
            });
            L.displayName = O;
            var D = "SliderRange",
                C = n.forwardRef((e, t) => {
                    let {
                        __scopeSlider: r,
                        ...a
                    } = e, l = N(D, r), f = S(D, r), i = n.useRef(null), u = (0, o.e)(t, i), s = l.values.length, c = l.values.map(e => q(e, l.min, l.max));
                    return (0, b.jsx)(d.WV.span, {
                        "data-orientation": l.orientation,
                        "data-disabled": l.disabled ? "" : void 0,
                        ...a,
                        ref: u,
                        style: { ...e.style,
                            [f.startEdge]: (s > 1 ? Math.min(...c) : 0) + "%",
                            [f.endEdge]: 100 - Math.max(...c) + "%"
                        }
                    })
                });
            C.displayName = D;
            var T = "SliderThumb",
                V = n.forwardRef((e, t) => {
                    let r = w(e.__scopeSlider),
                        [a, l] = n.useState(null),
                        f = (0, o.e)(t, e => l(e)),
                        i = n.useMemo(() => a ? r().findIndex(e => e.ref.current === a) : -1, [r, a]);
                    return (0, b.jsx)($, { ...e,
                        ref: f,
                        index: i
                    })
                }),
                $ = n.forwardRef((e, t) => {
                    var r;
                    let {
                        __scopeSlider: a,
                        index: f,
                        name: i,
                        ...u
                    } = e, s = N(T, a), h = S(T, a), [g, p] = n.useState(null), m = (0, o.e)(t, e => p(e)), y = !g || !!g.closest("form"), w = (0, c.t)(g), k = s.values[f], x = void 0 === k ? 0 : q(k, s.min, s.max), _ = (r = s.values.length) > 2 ? "Value ".concat(f + 1, " of ").concat(r) : 2 === r ? ["Minimum", "Maximum"][f] : void 0, M = null == w ? void 0 : w[h.size], E = M ? function(e, t, r) {
                        let n = e / 2,
                            a = B([0, 50], [0, n]);
                        return (n - a(t) * r) * r
                    }(M, x, h.direction) : 0;
                    return n.useEffect(() => {
                        if (g) return s.thumbs.add(g), () => {
                            s.thumbs.delete(g)
                        }
                    }, [g, s.thumbs]), (0, b.jsxs)("span", {
                        style: {
                            transform: "var(--radix-slider-thumb-transform)",
                            position: "absolute",
                            [h.startEdge]: "calc(".concat(x, "% + ").concat(E, "px)")
                        },
                        children: [(0, b.jsx)(v.ItemSlot, {
                            scope: e.__scopeSlider,
                            children: (0, b.jsx)(d.WV.span, {
                                role: "slider",
                                "aria-label": e["aria-label"] || _,
                                "aria-valuemin": s.min,
                                "aria-valuenow": k,
                                "aria-valuemax": s.max,
                                "aria-orientation": s.orientation,
                                "data-orientation": s.orientation,
                                "data-disabled": s.disabled ? "" : void 0,
                                tabIndex: s.disabled ? void 0 : 0,
                                ...u,
                                ref: m,
                                style: void 0 === k ? {
                                    display: "none"
                                } : e.style,
                                onFocus: (0, l.M)(e.onFocus, () => {
                                    s.valueIndexToChangeRef.current = f
                                })
                            })
                        }), y && (0, b.jsx)(I, {
                            name: null != i ? i : s.name ? s.name + (s.values.length > 1 ? "[]" : "") : void 0,
                            value: k
                        }, f)]
                    })
                });
            V.displayName = T;
            var I = e => {
                let {
                    value: t,
                    ...r
                } = e, a = n.useRef(null), l = (0, s.D)(t);
                return n.useEffect(() => {
                    let e = a.current,
                        r = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    if (l !== t && r) {
                        let n = new Event("input", {
                            bubbles: !0
                        });
                        r.call(e, t), e.dispatchEvent(n)
                    }
                }, [l, t]), (0, b.jsx)("input", {
                    style: {
                        display: "none"
                    },
                    ...r,
                    ref: a,
                    defaultValue: t
                })
            };

            function q(e, t, r) {
                return (0, a.u)(100 / (r - t) * (e - t), [0, 100])
            }

            function B(e, t) {
                return r => {
                    if (e[0] === e[1] || t[0] === t[1]) return t[0];
                    let n = (t[1] - t[0]) / (e[1] - e[0]);
                    return t[0] + n * (r - e[0])
                }
            }
            var G = E,
                Y = L,
                z = C,
                U = V
        },
        34001: function(e, t, r) {
            "use strict";
            r.d(t, {
                D: function() {
                    return a
                }
            });
            var n = r(55185);

            function a(e) {
                let t = n.useRef({
                    value: e,
                    previous: e
                });
                return n.useMemo(() => (t.current.value !== e && (t.current.previous = t.current.value, t.current.value = e), t.current.previous), [e])
            }
        },
        92974: function(e, t, r) {
            "use strict";
            r.d(t, {
                Z: function() {
                    return tg
                }
            });
            var n = (e, t = 0, r = 1) => s(c(t, e), r),
                a = e => {
                    e._clipped = !1, e._unclipped = e.slice(0);
                    for (let t = 0; t <= 3; t++) t < 3 ? ((e[t] < 0 || e[t] > 255) && (e._clipped = !0), e[t] = n(e[t], 0, 255)) : 3 === t && (e[t] = n(e[t], 0, 1));
                    return e
                };
            let l = {};
            for (let e of ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Undefined", "Null"]) l[`[object ${e}]`] = e.toLowerCase();

            function o(e) {
                return l[Object.prototype.toString.call(e)] || "object"
            }
            var f = (e, t = null) => e.length >= 3 ? Array.prototype.slice.call(e) : "object" == o(e[0]) && t ? t.split("").filter(t => void 0 !== e[0][t]).map(t => e[0][t]) : e[0],
                i = e => {
                    if (e.length < 2) return null;
                    let t = e.length - 1;
                    return "string" == o(e[t]) ? e[t].toLowerCase() : null
                };
            let {
                PI: u,
                min: s,
                max: c
            } = Math, d = 2 * u, h = u / 3, b = u / 180, g = 180 / u;
            var p = {
                format: {},
                autodetect: []
            };
            class m {
                constructor(...e) {
                    if ("object" === o(e[0]) && e[0].constructor && e[0].constructor === this.constructor) return e[0];
                    let t = i(e),
                        r = !1;
                    if (!t) {
                        for (let n of (r = !0, p.sorted || (p.autodetect = p.autodetect.sort((e, t) => t.p - e.p), p.sorted = !0), p.autodetect))
                            if (t = n.test(...e)) break
                    }
                    if (p.format[t]) {
                        let n = p.format[t].apply(null, r ? e : e.slice(0, -1));
                        this._rgb = a(n)
                    } else throw Error("unknown format: " + e);
                    3 === this._rgb.length && this._rgb.push(1)
                }
                toString() {
                    return "function" == o(this.hex) ? this.hex() : `[${this._rgb.join(",")}]`
                }
            }
            let y = (...e) => new y.Color(...e);
            y.Color = m, y.version = "2.6.0";
            let {
                max: v
            } = Math;
            var w = (...e) => {
                let [t, r, n] = f(e, "rgb"), a = 1 - v(t /= 255, v(r /= 255, n /= 255)), l = a < 1 ? 1 / (1 - a) : 0;
                return [(1 - t - a) * l, (1 - r - a) * l, (1 - n - a) * l, a]
            };
            m.prototype.cmyk = function() {
                return w(this._rgb)
            }, y.cmyk = (...e) => new m(...e, "cmyk"), p.format.cmyk = (...e) => {
                let [t, r, n, a] = e = f(e, "cmyk"), l = e.length > 4 ? e[4] : 1;
                return 1 === a ? [0, 0, 0, l] : [t >= 1 ? 0 : 255 * (1 - t) * (1 - a), r >= 1 ? 0 : 255 * (1 - r) * (1 - a), n >= 1 ? 0 : 255 * (1 - n) * (1 - a), l]
            }, p.autodetect.push({
                p: 2,
                test: (...e) => {
                    if ("array" === o(e = f(e, "cmyk")) && 4 === e.length) return "cmyk"
                }
            });
            let k = e => Math.round(100 * e) / 100;
            var x = (...e) => {
                    let t = f(e, "hsla"),
                        r = i(e) || "lsa";
                    return t[0] = k(t[0] || 0), t[1] = k(100 * t[1]) + "%", t[2] = k(100 * t[2]) + "%", "hsla" === r || t.length > 3 && t[3] < 1 ? (t[3] = t.length > 3 ? t[3] : 1, r = "hsla") : t.length = 3, `${r}(${t.join(",")})`
                },
                _ = (...e) => {
                    let t, r;
                    let [n, a, l] = e = f(e, "rgba"), o = s(n /= 255, a /= 255, l /= 255), i = c(n, a, l), u = (i + o) / 2;
                    return (i === o ? (t = 0, r = Number.NaN) : t = u < .5 ? (i - o) / (i + o) : (i - o) / (2 - i - o), n == i ? r = (a - l) / (i - o) : a == i ? r = 2 + (l - n) / (i - o) : l == i && (r = 4 + (n - a) / (i - o)), (r *= 60) < 0 && (r += 360), e.length > 3 && void 0 !== e[3]) ? [r, t, u, e[3]] : [r, t, u]
                };
            let {
                round: M
            } = Math;
            var N = (...e) => {
                let t = f(e, "rgba"),
                    r = i(e) || "rgb";
                return "hsl" == r.substr(0, 3) ? x(_(t), r) : (t[0] = M(t[0]), t[1] = M(t[1]), t[2] = M(t[2]), ("rgba" === r || t.length > 3 && t[3] < 1) && (t[3] = t.length > 3 ? t[3] : 1, r = "rgba"), `${r}(${t.slice(0,"rgb"===r?3:4).join(",")})`)
            };
            let {
                round: E
            } = Math;
            var j = (...e) => {
                let t, r, n;
                let [a, l, o] = e = f(e, "hsl");
                if (0 === l) t = r = n = 255 * o;
                else {
                    let e = [0, 0, 0],
                        f = [0, 0, 0],
                        i = o < .5 ? o * (1 + l) : o + l - o * l,
                        u = 2 * o - i,
                        s = a / 360;
                    e[0] = s + 1 / 3, e[1] = s, e[2] = s - 1 / 3;
                    for (let t = 0; t < 3; t++) e[t] < 0 && (e[t] += 1), e[t] > 1 && (e[t] -= 1), 6 * e[t] < 1 ? f[t] = u + (i - u) * 6 * e[t] : 2 * e[t] < 1 ? f[t] = i : 3 * e[t] < 2 ? f[t] = u + (i - u) * (2 / 3 - e[t]) * 6 : f[t] = u;
                    [t, r, n] = [E(255 * f[0]), E(255 * f[1]), E(255 * f[2])]
                }
                return e.length > 3 ? [t, r, n, e[3]] : [t, r, n, 1]
            };
            let S = /^rgb\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/,
                R = /^rgba\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*([01]|[01]?\.\d+)\)$/,
                A = /^rgb\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/,
                P = /^rgba\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,
                O = /^hsl\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/,
                L = /^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,
                {
                    round: D
                } = Math,
                C = e => {
                    let t;
                    if (e = e.toLowerCase().trim(), p.format.named) try {
                        return p.format.named(e)
                    } catch (e) {}
                    if (t = e.match(S)) {
                        let e = t.slice(1, 4);
                        for (let t = 0; t < 3; t++) e[t] = +e[t];
                        return e[3] = 1, e
                    }
                    if (t = e.match(R)) {
                        let e = t.slice(1, 5);
                        for (let t = 0; t < 4; t++) e[t] = +e[t];
                        return e
                    }
                    if (t = e.match(A)) {
                        let e = t.slice(1, 4);
                        for (let t = 0; t < 3; t++) e[t] = D(2.55 * e[t]);
                        return e[3] = 1, e
                    }
                    if (t = e.match(P)) {
                        let e = t.slice(1, 5);
                        for (let t = 0; t < 3; t++) e[t] = D(2.55 * e[t]);
                        return e[3] = +e[3], e
                    }
                    if (t = e.match(O)) {
                        let e = t.slice(1, 4);
                        e[1] *= .01, e[2] *= .01;
                        let r = j(e);
                        return r[3] = 1, r
                    }
                    if (t = e.match(L)) {
                        let e = t.slice(1, 4);
                        e[1] *= .01, e[2] *= .01;
                        let r = j(e);
                        return r[3] = +t[4], r
                    }
                };
            C.test = e => S.test(e) || R.test(e) || A.test(e) || P.test(e) || O.test(e) || L.test(e), m.prototype.css = function(e) {
                return N(this._rgb, e)
            }, y.css = (...e) => new m(...e, "css"), p.format.css = C, p.autodetect.push({
                p: 5,
                test: (e, ...t) => {
                    if (!t.length && "string" === o(e) && C.test(e)) return "css"
                }
            }), p.format.gl = (...e) => {
                let t = f(e, "rgba");
                return t[0] *= 255, t[1] *= 255, t[2] *= 255, t
            }, y.gl = (...e) => new m(...e, "gl"), m.prototype.gl = function() {
                let e = this._rgb;
                return [e[0] / 255, e[1] / 255, e[2] / 255, e[3]]
            };
            let {
                floor: T
            } = Math;
            var V = (...e) => {
                let t;
                let [r, n, a] = f(e, "rgb"), l = s(r, n, a), o = c(r, n, a), i = o - l;
                return 0 === i ? t = Number.NaN : (r === o && (t = (n - a) / i), n === o && (t = 2 + (a - r) / i), a === o && (t = 4 + (r - n) / i), (t *= 60) < 0 && (t += 360)), [t, 100 * i / 255, l / (255 - i) * 100]
            };
            m.prototype.hcg = function() {
                return V(this._rgb)
            }, y.hcg = (...e) => new m(...e, "hcg"), p.format.hcg = (...e) => {
                let t, r, n;
                let [a, l, o] = e = f(e, "hcg");
                o *= 255;
                let i = 255 * l;
                if (0 === l) t = r = n = o;
                else {
                    360 === a && (a = 0), a > 360 && (a -= 360), a < 0 && (a += 360);
                    let e = T(a /= 60),
                        f = a - e,
                        u = o * (1 - l),
                        s = u + i * (1 - f),
                        c = u + i * f,
                        d = u + i;
                    switch (e) {
                        case 0:
                            [t, r, n] = [d, c, u];
                            break;
                        case 1:
                            [t, r, n] = [s, d, u];
                            break;
                        case 2:
                            [t, r, n] = [u, d, c];
                            break;
                        case 3:
                            [t, r, n] = [u, s, d];
                            break;
                        case 4:
                            [t, r, n] = [c, u, d];
                            break;
                        case 5:
                            [t, r, n] = [d, u, s]
                    }
                }
                return [t, r, n, e.length > 3 ? e[3] : 1]
            }, p.autodetect.push({
                p: 1,
                test: (...e) => {
                    if ("array" === o(e = f(e, "hcg")) && 3 === e.length) return "hcg"
                }
            });
            let $ = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
                I = /^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/;
            var q = e => {
                if (e.match($)) {
                    (4 === e.length || 7 === e.length) && (e = e.substr(1)), 3 === e.length && (e = (e = e.split(""))[0] + e[0] + e[1] + e[1] + e[2] + e[2]);
                    let t = parseInt(e, 16);
                    return [t >> 16, t >> 8 & 255, 255 & t, 1]
                }
                if (e.match(I)) {
                    (5 === e.length || 9 === e.length) && (e = e.substr(1)), 4 === e.length && (e = (e = e.split(""))[0] + e[0] + e[1] + e[1] + e[2] + e[2] + e[3] + e[3]);
                    let t = parseInt(e, 16);
                    return [t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, Math.round((255 & t) / 255 * 100) / 100]
                }
                throw Error(`unknown hex color: ${e}`)
            };
            let {
                round: B
            } = Math;
            var G = (...e) => {
                let [t, r, n, a] = f(e, "rgba"), l = i(e) || "auto";
                void 0 === a && (a = 1), "auto" === l && (l = a < 1 ? "rgba" : "rgb");
                let o = "000000" + ((t = B(t)) << 16 | (r = B(r)) << 8 | (n = B(n))).toString(16);
                o = o.substr(o.length - 6);
                let u = "0" + B(255 * a).toString(16);
                switch (u = u.substr(u.length - 2), l.toLowerCase()) {
                    case "rgba":
                        return `#${o}${u}`;
                    case "argb":
                        return `#${u}${o}`;
                    default:
                        return `#${o}`
                }
            };
            m.prototype.hex = function(e) {
                return G(this._rgb, e)
            }, y.hex = (...e) => new m(...e, "hex"), p.format.hex = q, p.autodetect.push({
                p: 4,
                test: (e, ...t) => {
                    if (!t.length && "string" === o(e) && [3, 4, 5, 6, 7, 8, 9].indexOf(e.length) >= 0) return "hex"
                }
            });
            let {
                cos: Y
            } = Math, {
                min: z,
                sqrt: U,
                acos: F
            } = Math;
            var K = (...e) => {
                let t, [r, n, a] = f(e, "rgb"),
                    l = z(r /= 255, n /= 255, a /= 255),
                    o = (r + n + a) / 3,
                    i = o > 0 ? 1 - l / o : 0;
                return 0 === i ? t = NaN : (t = F(t = (r - n + (r - a)) / 2 / U((r - n) * (r - n) + (r - a) * (n - a))), a > n && (t = d - t), t /= d), [360 * t, i, o]
            };
            m.prototype.hsi = function() {
                return K(this._rgb)
            }, y.hsi = (...e) => new m(...e, "hsi"), p.format.hsi = (...e) => {
                let t, r, a;
                let [l, o, i] = e = f(e, "hsi");
                return isNaN(l) && (l = 0), isNaN(o) && (o = 0), l > 360 && (l -= 360), l < 0 && (l += 360), (l /= 360) < 1 / 3 ? r = 1 - ((a = (1 - o) / 3) + (t = (1 + o * Y(d * l) / Y(h - d * l)) / 3)) : l < 2 / 3 ? (l -= 1 / 3, a = 1 - ((t = (1 - o) / 3) + (r = (1 + o * Y(d * l) / Y(h - d * l)) / 3))) : (l -= 2 / 3, t = 1 - ((r = (1 - o) / 3) + (a = (1 + o * Y(d * l) / Y(h - d * l)) / 3))), [255 * (t = n(i * t * 3)), 255 * (r = n(i * r * 3)), 255 * (a = n(i * a * 3)), e.length > 3 ? e[3] : 1]
            }, p.autodetect.push({
                p: 2,
                test: (...e) => {
                    if ("array" === o(e = f(e, "hsi")) && 3 === e.length) return "hsi"
                }
            }), m.prototype.hsl = function() {
                return _(this._rgb)
            }, y.hsl = (...e) => new m(...e, "hsl"), p.format.hsl = j, p.autodetect.push({
                p: 2,
                test: (...e) => {
                    if ("array" === o(e = f(e, "hsl")) && 3 === e.length) return "hsl"
                }
            });
            let {
                floor: X
            } = Math, {
                min: Z,
                max: H
            } = Math;
            var W = (...e) => {
                let t, r, n;
                let [a, l, o] = e = f(e, "rgb"), i = Z(a, l, o), u = H(a, l, o), s = u - i;
                return n = u / 255, 0 === u ? (t = Number.NaN, r = 0) : (r = s / u, a === u && (t = (l - o) / s), l === u && (t = 2 + (o - a) / s), o === u && (t = 4 + (a - l) / s), (t *= 60) < 0 && (t += 360)), [t, r, n]
            };
            m.prototype.hsv = function() {
                return W(this._rgb)
            }, y.hsv = (...e) => new m(...e, "hsv"), p.format.hsv = (...e) => {
                let t, r, n;
                let [a, l, o] = e = f(e, "hsv");
                if (o *= 255, 0 === l) t = r = n = o;
                else {
                    360 === a && (a = 0), a > 360 && (a -= 360), a < 0 && (a += 360);
                    let e = X(a /= 60),
                        f = a - e,
                        i = o * (1 - l),
                        u = o * (1 - l * f),
                        s = o * (1 - l * (1 - f));
                    switch (e) {
                        case 0:
                            [t, r, n] = [o, s, i];
                            break;
                        case 1:
                            [t, r, n] = [u, o, i];
                            break;
                        case 2:
                            [t, r, n] = [i, o, s];
                            break;
                        case 3:
                            [t, r, n] = [i, u, o];
                            break;
                        case 4:
                            [t, r, n] = [s, i, o];
                            break;
                        case 5:
                            [t, r, n] = [o, i, u]
                    }
                }
                return [t, r, n, e.length > 3 ? e[3] : 1]
            }, p.autodetect.push({
                p: 2,
                test: (...e) => {
                    if ("array" === o(e = f(e, "hsv")) && 3 === e.length) return "hsv"
                }
            });
            var J = {
                Kn: 18,
                Xn: .95047,
                Yn: 1,
                Zn: 1.08883,
                t0: .137931034,
                t1: .206896552,
                t2: .12841855,
                t3: .008856452
            };
            let {
                pow: Q
            } = Math, ee = e => 255 * (e <= .00304 ? 12.92 * e : 1.055 * Q(e, 1 / 2.4) - .055), et = e => e > J.t1 ? e * e * e : J.t2 * (e - J.t0);
            var er = (...e) => {
                let t, r, n;
                let [a, l, o] = e = f(e, "lab");
                return r = (a + 16) / 116, t = isNaN(l) ? r : r + l / 500, n = isNaN(o) ? r : r - o / 200, r = J.Yn * et(r), [ee(3.2404542 * (t = J.Xn * et(t)) - 1.5371385 * r - .4985314 * (n = J.Zn * et(n))), ee(-.969266 * t + 1.8760108 * r + .041556 * n), ee(.0556434 * t - .2040259 * r + 1.0572252 * n), e.length > 3 ? e[3] : 1]
            };
            let {
                pow: en
            } = Math, ea = e => (e /= 255) <= .04045 ? e / 12.92 : en((e + .055) / 1.055, 2.4), el = e => e > J.t3 ? en(e, 1 / 3) : e / J.t2 + J.t0, eo = (e, t, r) => [el((.4124564 * (e = ea(e)) + .3575761 * (t = ea(t)) + .1804375 * (r = ea(r))) / J.Xn), el((.2126729 * e + .7151522 * t + .072175 * r) / J.Yn), el((.0193339 * e + .119192 * t + .9503041 * r) / J.Zn)];
            var ef = (...e) => {
                let [t, r, n] = f(e, "rgb"), [a, l, o] = eo(t, r, n), i = 116 * l - 16;
                return [i < 0 ? 0 : i, 500 * (a - l), 200 * (l - o)]
            };
            m.prototype.lab = function() {
                return ef(this._rgb)
            }, y.lab = (...e) => new m(...e, "lab"), p.format.lab = er, p.autodetect.push({
                p: 2,
                test: (...e) => {
                    if ("array" === o(e = f(e, "lab")) && 3 === e.length) return "lab"
                }
            });
            let {
                sin: ei,
                cos: eu
            } = Math;
            var es = (...e) => {
                    let [t, r, n] = f(e, "lch");
                    return isNaN(n) && (n = 0), [t, eu(n *= b) * r, ei(n) * r]
                },
                ec = (...e) => {
                    let [t, r, n] = e = f(e, "lch"), [a, l, o] = es(t, r, n), [i, u, s] = er(a, l, o);
                    return [i, u, s, e.length > 3 ? e[3] : 1]
                };
            let {
                sqrt: ed,
                atan2: eh,
                round: eb
            } = Math;
            var eg = (...e) => {
                    let [t, r, n] = f(e, "lab"), a = ed(r * r + n * n), l = (eh(n, r) * g + 360) % 360;
                    return 0 === eb(1e4 * a) && (l = Number.NaN), [t, a, l]
                },
                ep = (...e) => {
                    let [t, r, n] = f(e, "rgb"), [a, l, o] = ef(t, r, n);
                    return eg(a, l, o)
                };
            m.prototype.lch = function() {
                return ep(this._rgb)
            }, m.prototype.hcl = function() {
                return ep(this._rgb).reverse()
            }, y.lch = (...e) => new m(...e, "lch"), y.hcl = (...e) => new m(...e, "hcl"), p.format.lch = ec, p.format.hcl = (...e) => ec(...f(e, "hcl").reverse()), ["lch", "hcl"].forEach(e => p.autodetect.push({
                p: 2,
                test: (...t) => {
                    if ("array" === o(t = f(t, e)) && 3 === t.length) return e
                }
            }));
            var em = {
                aliceblue: "#f0f8ff",
                antiquewhite: "#faebd7",
                aqua: "#00ffff",
                aquamarine: "#7fffd4",
                azure: "#f0ffff",
                beige: "#f5f5dc",
                bisque: "#ffe4c4",
                black: "#000000",
                blanchedalmond: "#ffebcd",
                blue: "#0000ff",
                blueviolet: "#8a2be2",
                brown: "#a52a2a",
                burlywood: "#deb887",
                cadetblue: "#5f9ea0",
                chartreuse: "#7fff00",
                chocolate: "#d2691e",
                coral: "#ff7f50",
                cornflowerblue: "#6495ed",
                cornsilk: "#fff8dc",
                crimson: "#dc143c",
                cyan: "#00ffff",
                darkblue: "#00008b",
                darkcyan: "#008b8b",
                darkgoldenrod: "#b8860b",
                darkgray: "#a9a9a9",
                darkgreen: "#006400",
                darkgrey: "#a9a9a9",
                darkkhaki: "#bdb76b",
                darkmagenta: "#8b008b",
                darkolivegreen: "#556b2f",
                darkorange: "#ff8c00",
                darkorchid: "#9932cc",
                darkred: "#8b0000",
                darksalmon: "#e9967a",
                darkseagreen: "#8fbc8f",
                darkslateblue: "#483d8b",
                darkslategray: "#2f4f4f",
                darkslategrey: "#2f4f4f",
                darkturquoise: "#00ced1",
                darkviolet: "#9400d3",
                deeppink: "#ff1493",
                deepskyblue: "#00bfff",
                dimgray: "#696969",
                dimgrey: "#696969",
                dodgerblue: "#1e90ff",
                firebrick: "#b22222",
                floralwhite: "#fffaf0",
                forestgreen: "#228b22",
                fuchsia: "#ff00ff",
                gainsboro: "#dcdcdc",
                ghostwhite: "#f8f8ff",
                gold: "#ffd700",
                goldenrod: "#daa520",
                gray: "#808080",
                green: "#008000",
                greenyellow: "#adff2f",
                grey: "#808080",
                honeydew: "#f0fff0",
                hotpink: "#ff69b4",
                indianred: "#cd5c5c",
                indigo: "#4b0082",
                ivory: "#fffff0",
                khaki: "#f0e68c",
                laserlemon: "#ffff54",
                lavender: "#e6e6fa",
                lavenderblush: "#fff0f5",
                lawngreen: "#7cfc00",
                lemonchiffon: "#fffacd",
                lightblue: "#add8e6",
                lightcoral: "#f08080",
                lightcyan: "#e0ffff",
                lightgoldenrod: "#fafad2",
                lightgoldenrodyellow: "#fafad2",
                lightgray: "#d3d3d3",
                lightgreen: "#90ee90",
                lightgrey: "#d3d3d3",
                lightpink: "#ffb6c1",
                lightsalmon: "#ffa07a",
                lightseagreen: "#20b2aa",
                lightskyblue: "#87cefa",
                lightslategray: "#778899",
                lightslategrey: "#778899",
                lightsteelblue: "#b0c4de",
                lightyellow: "#ffffe0",
                lime: "#00ff00",
                limegreen: "#32cd32",
                linen: "#faf0e6",
                magenta: "#ff00ff",
                maroon: "#800000",
                maroon2: "#7f0000",
                maroon3: "#b03060",
                mediumaquamarine: "#66cdaa",
                mediumblue: "#0000cd",
                mediumorchid: "#ba55d3",
                mediumpurple: "#9370db",
                mediumseagreen: "#3cb371",
                mediumslateblue: "#7b68ee",
                mediumspringgreen: "#00fa9a",
                mediumturquoise: "#48d1cc",
                mediumvioletred: "#c71585",
                midnightblue: "#191970",
                mintcream: "#f5fffa",
                mistyrose: "#ffe4e1",
                moccasin: "#ffe4b5",
                navajowhite: "#ffdead",
                navy: "#000080",
                oldlace: "#fdf5e6",
                olive: "#808000",
                olivedrab: "#6b8e23",
                orange: "#ffa500",
                orangered: "#ff4500",
                orchid: "#da70d6",
                palegoldenrod: "#eee8aa",
                palegreen: "#98fb98",
                paleturquoise: "#afeeee",
                palevioletred: "#db7093",
                papayawhip: "#ffefd5",
                peachpuff: "#ffdab9",
                peru: "#cd853f",
                pink: "#ffc0cb",
                plum: "#dda0dd",
                powderblue: "#b0e0e6",
                purple: "#800080",
                purple2: "#7f007f",
                purple3: "#a020f0",
                rebeccapurple: "#663399",
                red: "#ff0000",
                rosybrown: "#bc8f8f",
                royalblue: "#4169e1",
                saddlebrown: "#8b4513",
                salmon: "#fa8072",
                sandybrown: "#f4a460",
                seagreen: "#2e8b57",
                seashell: "#fff5ee",
                sienna: "#a0522d",
                silver: "#c0c0c0",
                skyblue: "#87ceeb",
                slateblue: "#6a5acd",
                slategray: "#708090",
                slategrey: "#708090",
                snow: "#fffafa",
                springgreen: "#00ff7f",
                steelblue: "#4682b4",
                tan: "#d2b48c",
                teal: "#008080",
                thistle: "#d8bfd8",
                tomato: "#ff6347",
                turquoise: "#40e0d0",
                violet: "#ee82ee",
                wheat: "#f5deb3",
                white: "#ffffff",
                whitesmoke: "#f5f5f5",
                yellow: "#ffff00",
                yellowgreen: "#9acd32"
            };
            m.prototype.name = function() {
                let e = G(this._rgb, "rgb");
                for (let t of Object.keys(em))
                    if (em[t] === e) return t.toLowerCase();
                return e
            }, p.format.named = e => {
                if (em[e = e.toLowerCase()]) return q(em[e]);
                throw Error("unknown color name: " + e)
            }, p.autodetect.push({
                p: 5,
                test: (e, ...t) => {
                    if (!t.length && "string" === o(e) && em[e.toLowerCase()]) return "named"
                }
            });
            var ey = (...e) => {
                let [t, r, n] = f(e, "rgb");
                return (t << 16) + (r << 8) + n
            };
            m.prototype.num = function() {
                return ey(this._rgb)
            }, y.num = (...e) => new m(...e, "num"), p.format.num = e => {
                if ("number" == o(e) && e >= 0 && e <= 16777215) return [e >> 16, e >> 8 & 255, 255 & e, 1];
                throw Error("unknown num color: " + e)
            }, p.autodetect.push({
                p: 5,
                test: (...e) => {
                    if (1 === e.length && "number" === o(e[0]) && e[0] >= 0 && e[0] <= 16777215) return "num"
                }
            });
            let {
                round: ev
            } = Math;
            m.prototype.rgb = function(e = !0) {
                return !1 === e ? this._rgb.slice(0, 3) : this._rgb.slice(0, 3).map(ev)
            }, m.prototype.rgba = function(e = !0) {
                return this._rgb.slice(0, 4).map((t, r) => r < 3 ? !1 === e ? t : ev(t) : t)
            }, y.rgb = (...e) => new m(...e, "rgb"), p.format.rgb = (...e) => {
                let t = f(e, "rgba");
                return void 0 === t[3] && (t[3] = 1), t
            }, p.autodetect.push({
                p: 3,
                test: (...e) => {
                    if ("array" === o(e = f(e, "rgba")) && (3 === e.length || 4 === e.length && "number" == o(e[3]) && e[3] >= 0 && e[3] <= 1)) return "rgb"
                }
            });
            let {
                log: ew
            } = Math;
            var ek = e => {
                let t, r, n;
                let a = e / 100;
                return a < 66 ? (t = 255, r = a < 6 ? 0 : -155.25485562709179 - .44596950469579133 * (r = a - 2) + 104.49216199393888 * ew(r), n = a < 20 ? 0 : -254.76935184120902 + .8274096064007395 * (n = a - 10) + 115.67994401066147 * ew(n)) : (t = 351.97690566805693 + .114206453784165 * (t = a - 55) - 40.25366309332127 * ew(t), r = 325.4494125711974 + .07943456536662342 * (r = a - 50) - 28.0852963507957 * ew(r), n = 255), [t, r, n, 1]
            };
            let {
                round: ex
            } = Math;
            var e_ = (...e) => {
                let t;
                let r = f(e, "rgb"),
                    n = r[0],
                    a = r[2],
                    l = 1e3,
                    o = 4e4;
                for (; o - l > .4;) {
                    let e = ek(t = (o + l) * .5);
                    e[2] / e[0] >= a / n ? o = t : l = t
                }
                return ex(t)
            };
            m.prototype.temp = m.prototype.kelvin = m.prototype.temperature = function() {
                return e_(this._rgb)
            }, y.temp = y.kelvin = y.temperature = (...e) => new m(...e, "temp"), p.format.temp = p.format.kelvin = p.format.temperature = ek;
            let {
                pow: eM,
                sign: eN
            } = Math;
            var eE = (...e) => {
                let [t, r, n] = e = f(e, "lab"), a = eM(t + .3963377774 * r + .2158037573 * n, 3), l = eM(t - .1055613458 * r - .0638541728 * n, 3), o = eM(t - .0894841775 * r - 1.291485548 * n, 3);
                return [255 * ej(4.0767416621 * a - 3.3077115913 * l + .2309699292 * o), 255 * ej(-1.2684380046 * a + 2.6097574011 * l - .3413193965 * o), 255 * ej(-.0041960863 * a - .7034186147 * l + 1.707614701 * o), e.length > 3 ? e[3] : 1]
            };

            function ej(e) {
                let t = Math.abs(e);
                return t > .0031308 ? (eN(e) || 1) * (1.055 * eM(t, 1 / 2.4) - .055) : 12.92 * e
            }
            let {
                cbrt: eS,
                pow: eR,
                sign: eA
            } = Math;
            var eP = (...e) => {
                let [t, r, n] = f(e, "rgb"), [a, l, o] = [eO(t / 255), eO(r / 255), eO(n / 255)], i = eS(.4122214708 * a + .5363325363 * l + .0514459929 * o), u = eS(.2119034982 * a + .6806995451 * l + .1073969566 * o), s = eS(.0883024619 * a + .2817188376 * l + .6299787005 * o);
                return [.2104542553 * i + .793617785 * u - .0040720468 * s, 1.9779984951 * i - 2.428592205 * u + .4505937099 * s, .0259040371 * i + .7827717662 * u - .808675766 * s]
            };

            function eO(e) {
                let t = Math.abs(e);
                return t < .04045 ? e / 12.92 : (eA(e) || 1) * eR((t + .055) / 1.055, 2.4)
            }
            m.prototype.oklab = function() {
                return eP(this._rgb)
            }, y.oklab = (...e) => new m(...e, "oklab"), p.format.oklab = eE, p.autodetect.push({
                p: 3,
                test: (...e) => {
                    if ("array" === o(e = f(e, "oklab")) && 3 === e.length) return "oklab"
                }
            });
            var eL = (...e) => {
                let [t, r, n] = f(e, "rgb"), [a, l, o] = eP(t, r, n);
                return eg(a, l, o)
            };
            m.prototype.oklch = function() {
                return eL(this._rgb)
            }, y.oklch = (...e) => new m(...e, "oklch"), p.format.oklch = (...e) => {
                let [t, r, n] = e = f(e, "lch"), [a, l, o] = es(t, r, n), [i, u, s] = eE(a, l, o);
                return [i, u, s, e.length > 3 ? e[3] : 1]
            }, p.autodetect.push({
                p: 3,
                test: (...e) => {
                    if ("array" === o(e = f(e, "oklch")) && 3 === e.length) return "oklch"
                }
            }), m.prototype.alpha = function(e, t = !1) {
                return void 0 !== e && "number" === o(e) ? t ? (this._rgb[3] = e, this) : new m([this._rgb[0], this._rgb[1], this._rgb[2], e], "rgb") : this._rgb[3]
            }, m.prototype.clipped = function() {
                return this._rgb._clipped || !1
            }, m.prototype.darken = function(e = 1) {
                let t = this.lab();
                return t[0] -= J.Kn * e, new m(t, "lab").alpha(this.alpha(), !0)
            }, m.prototype.brighten = function(e = 1) {
                return this.darken(-e)
            }, m.prototype.darker = m.prototype.darken, m.prototype.brighter = m.prototype.brighten, m.prototype.get = function(e) {
                let [t, r] = e.split("."), n = this[t]();
                if (!r) return n; {
                    let e = t.indexOf(r) - ("ok" === t.substr(0, 2) ? 2 : 0);
                    if (e > -1) return n[e];
                    throw Error(`unknown channel ${r} in mode ${t}`)
                }
            };
            let {
                pow: eD
            } = Math;
            m.prototype.luminance = function(e, t = "rgb") {
                if (void 0 !== e && "number" === o(e)) {
                    if (0 === e) return new m([0, 0, 0, this._rgb[3]], "rgb");
                    if (1 === e) return new m([255, 255, 255, this._rgb[3]], "rgb");
                    let r = this.luminance(),
                        n = 20,
                        a = (r, l) => {
                            let o = r.interpolate(l, .5, t),
                                f = o.luminance();
                            return !(1e-7 > Math.abs(e - f)) && n-- ? f > e ? a(r, o) : a(o, l) : o
                        },
                        l = (r > e ? a(new m([0, 0, 0]), this) : a(this, new m([255, 255, 255]))).rgb();
                    return new m([...l, this._rgb[3]])
                }
                return eC(...this._rgb.slice(0, 3))
            };
            let eC = (e, t, r) => .2126 * (e = eT(e)) + .7152 * (t = eT(t)) + .0722 * (r = eT(r)),
                eT = e => (e /= 255) <= .03928 ? e / 12.92 : eD((e + .055) / 1.055, 2.4);
            var eV = {},
                e$ = (e, t, r = .5, ...n) => {
                    let a = n[0] || "lrgb";
                    if (eV[a] || n.length || (a = Object.keys(eV)[0]), !eV[a]) throw Error(`interpolation mode ${a} is not defined`);
                    return "object" !== o(e) && (e = new m(e)), "object" !== o(t) && (t = new m(t)), eV[a](e, t, r).alpha(e.alpha() + r * (t.alpha() - e.alpha()))
                };
            m.prototype.mix = m.prototype.interpolate = function(e, t = .5, ...r) {
                return e$(this, e, t, ...r)
            }, m.prototype.premultiply = function(e = !1) {
                let t = this._rgb,
                    r = t[3];
                return e ? (this._rgb = [t[0] * r, t[1] * r, t[2] * r, r], this) : new m([t[0] * r, t[1] * r, t[2] * r, r], "rgb")
            }, m.prototype.saturate = function(e = 1) {
                let t = this.lch();
                return t[1] += J.Kn * e, t[1] < 0 && (t[1] = 0), new m(t, "lch").alpha(this.alpha(), !0)
            }, m.prototype.desaturate = function(e = 1) {
                return this.saturate(-e)
            }, m.prototype.set = function(e, t, r = !1) {
                let [n, a] = e.split("."), l = this[n]();
                if (!a) return l; {
                    let e = n.indexOf(a) - ("ok" === n.substr(0, 2) ? 2 : 0);
                    if (e > -1) {
                        if ("string" == o(t)) switch (t.charAt(0)) {
                                case "+":
                                case "-":
                                    l[e] += +t;
                                    break;
                                case "*":
                                    l[e] *= +t.substr(1);
                                    break;
                                case "/":
                                    l[e] /= +t.substr(1);
                                    break;
                                default:
                                    l[e] = +t
                            } else if ("number" === o(t)) l[e] = t;
                            else throw Error("unsupported value for Color.set");
                        let a = new m(l, n);
                        return r ? (this._rgb = a._rgb, this) : a
                    }
                    throw Error(`unknown channel ${a} in mode ${n}`)
                }
            }, m.prototype.tint = function(e = .5, ...t) {
                return e$(this, "white", e, ...t)
            }, m.prototype.shade = function(e = .5, ...t) {
                return e$(this, "black", e, ...t)
            }, eV.rgb = (e, t, r) => {
                let n = e._rgb,
                    a = t._rgb;
                return new m(n[0] + r * (a[0] - n[0]), n[1] + r * (a[1] - n[1]), n[2] + r * (a[2] - n[2]), "rgb")
            };
            let {
                sqrt: eI,
                pow: eq
            } = Math;
            eV.lrgb = (e, t, r) => {
                let [n, a, l] = e._rgb, [o, f, i] = t._rgb;
                return new m(eI(eq(n, 2) * (1 - r) + eq(o, 2) * r), eI(eq(a, 2) * (1 - r) + eq(f, 2) * r), eI(eq(l, 2) * (1 - r) + eq(i, 2) * r), "rgb")
            }, eV.lab = (e, t, r) => {
                let n = e.lab(),
                    a = t.lab();
                return new m(n[0] + r * (a[0] - n[0]), n[1] + r * (a[1] - n[1]), n[2] + r * (a[2] - n[2]), "lab")
            };
            var eB = (e, t, r, n) => {
                let a, l, o, f, i, u, s, c, d, h, b, g;
                return "hsl" === n ? (a = e.hsl(), l = t.hsl()) : "hsv" === n ? (a = e.hsv(), l = t.hsv()) : "hcg" === n ? (a = e.hcg(), l = t.hcg()) : "hsi" === n ? (a = e.hsi(), l = t.hsi()) : "lch" === n || "hcl" === n ? (n = "hcl", a = e.hcl(), l = t.hcl()) : "oklch" === n && (a = e.oklch().reverse(), l = t.oklch().reverse()), ("h" === n.substr(0, 1) || "oklch" === n) && ([o, i, s] = a, [f, u, c] = l), isNaN(o) || isNaN(f) ? isNaN(o) ? isNaN(f) ? h = Number.NaN : (h = f, (1 == s || 0 == s) && "hsv" != n && (d = u)) : (h = o, (1 == c || 0 == c) && "hsv" != n && (d = i)) : (g = f > o && f - o > 180 ? f - (o + 360) : f < o && o - f > 180 ? f + 360 - o : f - o, h = o + r * g), void 0 === d && (d = i + r * (u - i)), b = s + r * (c - s), "oklch" === n ? new m([b, d, h], n) : new m([h, d, b], n)
            };
            let eG = (e, t, r) => eB(e, t, r, "lch");
            eV.lch = eG, eV.hcl = eG, eV.num = (e, t, r) => {
                let n = e.num();
                return new m(n + r * (t.num() - n), "num")
            }, eV.hcg = (e, t, r) => eB(e, t, r, "hcg"), eV.hsi = (e, t, r) => eB(e, t, r, "hsi"), eV.hsl = (e, t, r) => eB(e, t, r, "hsl"), eV.hsv = (e, t, r) => eB(e, t, r, "hsv"), eV.oklab = (e, t, r) => {
                let n = e.oklab(),
                    a = t.oklab();
                return new m(n[0] + r * (a[0] - n[0]), n[1] + r * (a[1] - n[1]), n[2] + r * (a[2] - n[2]), "oklab")
            }, eV.oklch = (e, t, r) => eB(e, t, r, "oklch");
            let {
                pow: eY,
                sqrt: ez,
                PI: eU,
                cos: eF,
                sin: eK,
                atan2: eX
            } = Math, eZ = (e, t) => {
                let r = e.length,
                    n = [0, 0, 0, 0];
                for (let a = 0; a < e.length; a++) {
                    let l = e[a],
                        o = t[a] / r,
                        f = l._rgb;
                    n[0] += eY(f[0], 2) * o, n[1] += eY(f[1], 2) * o, n[2] += eY(f[2], 2) * o, n[3] += f[3] * o
                }
                return n[0] = ez(n[0]), n[1] = ez(n[1]), n[2] = ez(n[2]), n[3] > .9999999 && (n[3] = 1), new m(a(n))
            }, {
                pow: eH
            } = Math;

            function eW(e) {
                let t = "rgb",
                    r = y("#ccc"),
                    a = 0,
                    l = [0, 1],
                    f = [],
                    i = [0, 0],
                    u = !1,
                    s = [],
                    c = !1,
                    d = 0,
                    h = 1,
                    b = !1,
                    g = {},
                    p = !0,
                    m = 1,
                    v = function(e) {
                        if ("string" === o(e = e || ["#fff", "#000"]) && y.brewer && y.brewer[e.toLowerCase()] && (e = y.brewer[e.toLowerCase()]), "array" === o(e)) {
                            1 === e.length && (e = [e[0], e[0]]), e = e.slice(0);
                            for (let t = 0; t < e.length; t++) e[t] = y(e[t]);
                            f.length = 0;
                            for (let t = 0; t < e.length; t++) f.push(t / (e.length - 1))
                        }
                        return M(), s = e
                    },
                    w = function(e) {
                        if (null != u) {
                            let t = u.length - 1,
                                r = 0;
                            for (; r < t && e >= u[r];) r++;
                            return r - 1
                        }
                        return 0
                    },
                    k = e => e,
                    x = e => e,
                    _ = function(e, a) {
                        let l, c;
                        if (null == a && (a = !1), isNaN(e) || null === e) return r;
                        c = a ? e : u && u.length > 2 ? w(e) / (u.length - 2) : h !== d ? (e - d) / (h - d) : 1, c = x(c), a || (c = k(c)), 1 !== m && (c = eH(c, m));
                        let b = Math.floor(1e4 * (c = n(c = i[0] + c * (1 - i[0] - i[1]), 0, 1)));
                        if (p && g[b]) l = g[b];
                        else {
                            if ("array" === o(s))
                                for (let e = 0; e < f.length; e++) {
                                    let r = f[e];
                                    if (c <= r || c >= r && e === f.length - 1) {
                                        l = s[e];
                                        break
                                    }
                                    if (c > r && c < f[e + 1]) {
                                        c = (c - r) / (f[e + 1] - r), l = y.interpolate(s[e], s[e + 1], c, t);
                                        break
                                    }
                                } else "function" === o(s) && (l = s(c));
                            p && (g[b] = l)
                        }
                        return l
                    };
                var M = () => g = {};
                v(e);
                let N = function(e) {
                    let t = y(_(e));
                    return c && t[c] ? t[c]() : t
                };
                return N.classes = function(e) {
                    if (null != e) {
                        if ("array" === o(e)) u = e, l = [e[0], e[e.length - 1]];
                        else {
                            let t = y.analyze(l);
                            u = 0 === e ? [t.min, t.max] : y.limits(t, "e", e)
                        }
                        return N
                    }
                    return u
                }, N.domain = function(e) {
                    if (!arguments.length) return l;
                    d = e[0], h = e[e.length - 1], f = [];
                    let t = s.length;
                    if (e.length === t && d !== h)
                        for (let t of Array.from(e)) f.push((t - d) / (h - d));
                    else {
                        for (let e = 0; e < t; e++) f.push(e / (t - 1));
                        if (e.length > 2) {
                            let t = e.map((t, r) => r / (e.length - 1)),
                                r = e.map(e => (e - d) / (h - d));
                            r.every((e, r) => t[r] === e) || (x = e => {
                                if (e <= 0 || e >= 1) return e;
                                let n = 0;
                                for (; e >= r[n + 1];) n++;
                                let a = (e - r[n]) / (r[n + 1] - r[n]);
                                return t[n] + a * (t[n + 1] - t[n])
                            })
                        }
                    }
                    return l = [d, h], N
                }, N.mode = function(e) {
                    return arguments.length ? (t = e, M(), N) : t
                }, N.range = function(e, t) {
                    return v(e, t), N
                }, N.out = function(e) {
                    return c = e, N
                }, N.spread = function(e) {
                    return arguments.length ? (a = e, N) : a
                }, N.correctLightness = function(e) {
                    return null == e && (e = !0), b = e, M(), k = b ? function(e) {
                        let t = _(0, !0).lab()[0],
                            r = _(1, !0).lab()[0],
                            n = t > r,
                            a = _(e, !0).lab()[0],
                            l = t + (r - t) * e,
                            o = a - l,
                            f = 0,
                            i = 1,
                            u = 20;
                        for (; Math.abs(o) > .01 && u-- > 0;) n && (o *= -1), o < 0 ? (f = e, e += (i - e) * .5) : (i = e, e += (f - e) * .5), o = (a = _(e, !0).lab()[0]) - l;
                        return e
                    } : e => e, N
                }, N.padding = function(e) {
                    return null != e ? ("number" === o(e) && (e = [e, e]), i = e, N) : i
                }, N.colors = function(t, r) {
                    arguments.length < 2 && (r = "hex");
                    let n = [];
                    if (0 == arguments.length) n = s.slice(0);
                    else if (1 === t) n = [N(.5)];
                    else if (t > 1) {
                        let e = l[0],
                            r = l[1] - e;
                        n = (function(e, t, r) {
                            let n = [],
                                a = 0 < t,
                                l = r ? a ? t + 1 : t - 1 : t;
                            for (let e = 0; a ? e < l : e > l; a ? e++ : e--) n.push(e);
                            return n
                        })(0, t, !1).map(n => N(e + n / (t - 1) * r))
                    } else {
                        e = [];
                        let t = [];
                        if (u && u.length > 2)
                            for (let e = 1, r = u.length, n = 1 <= r; n ? e < r : e > r; n ? e++ : e--) t.push((u[e - 1] + u[e]) * .5);
                        else t = l;
                        n = t.map(e => N(e))
                    }
                    return y[r] && (n = n.map(e => e[r]())), n
                }, N.cache = function(e) {
                    return null != e ? (p = e, N) : p
                }, N.gamma = function(e) {
                    return null != e ? (m = e, N) : m
                }, N.nodata = function(e) {
                    return null != e ? (r = y(e), N) : r
                }, N
            }
            let eJ = function(e) {
                    let t = [1, 1];
                    for (let r = 1; r < e; r++) {
                        let e = [1];
                        for (let r = 1; r <= t.length; r++) e[r] = (t[r] || 0) + t[r - 1];
                        t = e
                    }
                    return t
                },
                eQ = function(e) {
                    let t, r, n, a;
                    if (2 === (e = e.map(e => new m(e))).length)[r, n] = e.map(e => e.lab()), t = function(e) {
                        return new m([0, 1, 2].map(t => r[t] + e * (n[t] - r[t])), "lab")
                    };
                    else if (3 === e.length)[r, n, a] = e.map(e => e.lab()), t = function(e) {
                        return new m([0, 1, 2].map(t => (1 - e) * (1 - e) * r[t] + 2 * (1 - e) * e * n[t] + e * e * a[t]), "lab")
                    };
                    else if (4 === e.length) {
                        let l;
                        [r, n, a, l] = e.map(e => e.lab()), t = function(e) {
                            return new m([0, 1, 2].map(t => (1 - e) * (1 - e) * (1 - e) * r[t] + 3 * (1 - e) * (1 - e) * e * n[t] + 3 * (1 - e) * e * e * a[t] + e * e * e * l[t]), "lab")
                        }
                    } else if (e.length >= 5) {
                        let r, n, a;
                        r = e.map(e => e.lab()), n = eJ(a = e.length - 1), t = function(e) {
                            let t = 1 - e;
                            return new m([0, 1, 2].map(l => r.reduce((r, o, f) => r + n[f] * t ** (a - f) * e ** f * o[l], 0)), "lab")
                        }
                    } else throw RangeError("No point in running bezier with only one color.");
                    return t
                },
                e0 = (e, t, r) => {
                    if (!e0[r]) throw Error("unknown blend mode " + r);
                    return e0[r](e, t)
                },
                e1 = e => (t, r) => {
                    let n = y(r).rgb(),
                        a = y(t).rgb();
                    return y.rgb(e(n, a))
                },
                e2 = e => (t, r) => {
                    let n = [];
                    return n[0] = e(t[0], r[0]), n[1] = e(t[1], r[1]), n[2] = e(t[2], r[2]), n
                };
            e0.normal = e1(e2(e => e)), e0.multiply = e1(e2((e, t) => e * t / 255)), e0.screen = e1(e2((e, t) => 255 * (1 - (1 - e / 255) * (1 - t / 255)))), e0.overlay = e1(e2((e, t) => t < 128 ? 2 * e * t / 255 : 255 * (1 - 2 * (1 - e / 255) * (1 - t / 255)))), e0.darken = e1(e2((e, t) => e > t ? t : e)), e0.lighten = e1(e2((e, t) => e > t ? e : t)), e0.dodge = e1(e2((e, t) => 255 === e ? 255 : (e = t / 255 * 255 / (1 - e / 255)) > 255 ? 255 : e)), e0.burn = e1(e2((e, t) => 255 * (1 - (1 - t / 255) / (e / 255))));
            let {
                pow: e5,
                sin: e3,
                cos: e6
            } = Math, {
                floor: e8,
                random: e4
            } = Math, {
                log: e7,
                pow: e9,
                floor: te,
                abs: tt
            } = Math;

            function tr(e, t = null) {
                let r = {
                    min: Number.MAX_VALUE,
                    max: -1 * Number.MAX_VALUE,
                    sum: 0,
                    values: [],
                    count: 0
                };
                return "object" === o(e) && (e = Object.values(e)), e.forEach(e => {
                    t && "object" === o(e) && (e = e[t]), null == e || isNaN(e) || (r.values.push(e), r.sum += e, e < r.min && (r.min = e), e > r.max && (r.max = e), r.count += 1)
                }), r.domain = [r.min, r.max], r.limits = (e, t) => tn(r, e, t), r
            }

            function tn(e, t = "equal", r = 7) {
                "array" == o(e) && (e = tr(e));
                let {
                    min: n,
                    max: a
                } = e, l = e.values.sort((e, t) => e - t);
                if (1 === r) return [n, a];
                let f = [];
                if ("c" === t.substr(0, 1) && (f.push(n), f.push(a)), "e" === t.substr(0, 1)) {
                    f.push(n);
                    for (let e = 1; e < r; e++) f.push(n + e / r * (a - n));
                    f.push(a)
                } else if ("l" === t.substr(0, 1)) {
                    if (n <= 0) throw Error("Logarithmic scales are only possible for values > 0");
                    let e = Math.LOG10E * e7(n),
                        t = Math.LOG10E * e7(a);
                    f.push(n);
                    for (let n = 1; n < r; n++) f.push(e9(10, e + n / r * (t - e)));
                    f.push(a)
                } else if ("q" === t.substr(0, 1)) {
                    f.push(n);
                    for (let e = 1; e < r; e++) {
                        let t = (l.length - 1) * e / r,
                            n = te(t);
                        if (n === t) f.push(l[n]);
                        else {
                            let e = t - n;
                            f.push(l[n] * (1 - e) + l[n + 1] * e)
                        }
                    }
                    f.push(a)
                } else if ("k" === t.substr(0, 1)) {
                    let e;
                    let t = l.length,
                        o = Array(t),
                        i = Array(r),
                        u = !0,
                        s = 0,
                        c = null;
                    (c = []).push(n);
                    for (let e = 1; e < r; e++) c.push(n + e / r * (a - n));
                    for (c.push(a); u;) {
                        for (let e = 0; e < r; e++) i[e] = 0;
                        for (let e = 0; e < t; e++) {
                            let t;
                            let n = l[e],
                                a = Number.MAX_VALUE;
                            for (let l = 0; l < r; l++) {
                                let r = tt(c[l] - n);
                                r < a && (a = r, t = l), i[t]++, o[e] = t
                            }
                        }
                        let n = Array(r);
                        for (let e = 0; e < r; e++) n[e] = null;
                        for (let r = 0; r < t; r++) null === n[e = o[r]] ? n[e] = l[r] : n[e] += l[r];
                        for (let e = 0; e < r; e++) n[e] *= 1 / i[e];
                        u = !1;
                        for (let e = 0; e < r; e++)
                            if (n[e] !== c[e]) {
                                u = !0;
                                break
                            }
                        c = n, ++s > 200 && (u = !1)
                    }
                    let d = {};
                    for (let e = 0; e < r; e++) d[e] = [];
                    for (let r = 0; r < t; r++) d[e = o[r]].push(l[r]);
                    let h = [];
                    for (let e = 0; e < r; e++) h.push(d[e][0]), h.push(d[e][d[e].length - 1]);
                    h = h.sort((e, t) => e - t), f.push(h[0]);
                    for (let e = 1; e < h.length; e += 2) {
                        let t = h[e];
                        isNaN(t) || -1 !== f.indexOf(t) || f.push(t)
                    }
                }
                return f
            }
            let {
                sqrt: ta,
                pow: tl,
                min: to,
                max: tf,
                atan2: ti,
                abs: tu,
                cos: ts,
                sin: tc,
                exp: td,
                PI: th
            } = Math, tb = {
                OrRd: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
                PuBu: ["#fff7fb", "#ece7f2", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#045a8d", "#023858"],
                BuPu: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
                Oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
                BuGn: ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#006d2c", "#00441b"],
                YlOrBr: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#993404", "#662506"],
                YlGn: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529"],
                Reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
                RdPu: ["#fff7f3", "#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177", "#49006a"],
                Greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
                YlGnBu: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"],
                Purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"],
                GnBu: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"],
                Greys: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
                YlOrRd: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
                PuRd: ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#980043", "#67001f"],
                Blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
                PuBuGn: ["#fff7fb", "#ece2f0", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016c59", "#014636"],
                Viridis: ["#440154", "#482777", "#3f4a8a", "#31678e", "#26838f", "#1f9d8a", "#6cce5a", "#b6de2b", "#fee825"],
                Spectral: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
                RdYlGn: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
                RdBu: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
                PiYG: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"],
                PRGn: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"],
                RdYlBu: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"],
                BrBG: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
                RdGy: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#ffffff", "#e0e0e0", "#bababa", "#878787", "#4d4d4d", "#1a1a1a"],
                PuOr: ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac", "#542788", "#2d004b"],
                Set2: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
                Accent: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"],
                Set1: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
                Set3: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"],
                Dark2: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
                Paired: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
                Pastel2: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc", "#cccccc"],
                Pastel1: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"]
            };
            for (let e of Object.keys(tb)) tb[e.toLowerCase()] = tb[e];
            Object.assign(y, {
                average: (e, t = "lrgb", r = null) => {
                    let n = e.length;
                    r || (r = Array.from(Array(n)).map(() => 1));
                    let a = n / r.reduce(function(e, t) {
                        return e + t
                    });
                    if (r.forEach((e, t) => {
                            r[t] *= a
                        }), e = e.map(e => new m(e)), "lrgb" === t) return eZ(e, r);
                    let l = e.shift(),
                        o = l.get(t),
                        f = [],
                        i = 0,
                        u = 0;
                    for (let e = 0; e < o.length; e++)
                        if (o[e] = (o[e] || 0) * r[0], f.push(isNaN(o[e]) ? 0 : r[0]), "h" === t.charAt(e) && !isNaN(o[e])) {
                            let t = o[e] / 180 * eU;
                            i += eF(t) * r[0], u += eK(t) * r[0]
                        }
                    let s = l.alpha() * r[0];
                    e.forEach((e, n) => {
                        let a = e.get(t);
                        s += e.alpha() * r[n + 1];
                        for (let e = 0; e < o.length; e++)
                            if (!isNaN(a[e])) {
                                if (f[e] += r[n + 1], "h" === t.charAt(e)) {
                                    let t = a[e] / 180 * eU;
                                    i += eF(t) * r[n + 1], u += eK(t) * r[n + 1]
                                } else o[e] += a[e] * r[n + 1]
                            }
                    });
                    for (let e = 0; e < o.length; e++)
                        if ("h" === t.charAt(e)) {
                            let t = eX(u / f[e], i / f[e]) / eU * 180;
                            for (; t < 0;) t += 360;
                            for (; t >= 360;) t -= 360;
                            o[e] = t
                        } else o[e] = o[e] / f[e];
                    return s /= n, new m(o, t).alpha(s > .99999 ? 1 : s, !0)
                },
                bezier: e => {
                    let t = eQ(e);
                    return t.scale = () => eW(t), t
                },
                blend: e0,
                cubehelix: function(e = 300, t = -1.5, r = 1, n = 1, l = [0, 1]) {
                    let f = 0,
                        i;
                    "array" === o(l) ? i = l[1] - l[0] : (i = 0, l = [l, l]);
                    let u = function(o) {
                        let u = d * ((e + 120) / 360 + t * o),
                            s = e5(l[0] + i * o, n),
                            c = (0 !== f ? r[0] + o * f : r) * s * (1 - s) / 2,
                            h = e6(u),
                            b = e3(u);
                        return y(a([255 * (s + c * (-.14861 * h + 1.78277 * b)), 255 * (s + c * (-.29227 * h - .90649 * b)), 255 * (s + 1.97294 * h * c), 1]))
                    };
                    return u.start = function(t) {
                        return null == t ? e : (e = t, u)
                    }, u.rotations = function(e) {
                        return null == e ? t : (t = e, u)
                    }, u.gamma = function(e) {
                        return null == e ? n : (n = e, u)
                    }, u.hue = function(e) {
                        return null == e ? r : ("array" === o(r = e) ? 0 == (f = r[1] - r[0]) && (r = r[1]) : f = 0, u)
                    }, u.lightness = function(e) {
                        return null == e ? l : ("array" === o(e) ? (l = e, i = e[1] - e[0]) : (l = [e, e], i = 0), u)
                    }, u.scale = () => y.scale(u), u.hue(r), u
                },
                mix: e$,
                interpolate: e$,
                random: () => {
                    let e = "#";
                    for (let t = 0; t < 6; t++) e += "0123456789abcdef".charAt(e8(16 * e4()));
                    return new m(e, "hex")
                },
                scale: eW,
                analyze: tr,
                contrast: (e, t) => {
                    e = new m(e), t = new m(t);
                    let r = e.luminance(),
                        n = t.luminance();
                    return r > n ? (r + .05) / (n + .05) : (n + .05) / (r + .05)
                },
                deltaE: function(e, t, r = 1, n = 1, a = 1) {
                    var l = function(e) {
                            return 360 * e / (2 * th)
                        },
                        o = function(e) {
                            return 2 * th * e / 360
                        };
                    e = new m(e), t = new m(t);
                    let [f, i, u] = Array.from(e.lab()), [s, c, d] = Array.from(t.lab()), h = (f + s) / 2, b = (ta(tl(i, 2) + tl(u, 2)) + ta(tl(c, 2) + tl(d, 2))) / 2, g = .5 * (1 - ta(tl(b, 7) / (tl(b, 7) + tl(25, 7)))), p = i * (1 + g), y = c * (1 + g), v = ta(tl(p, 2) + tl(u, 2)), w = ta(tl(y, 2) + tl(d, 2)), k = (v + w) / 2, x = l(ti(u, p)), _ = l(ti(d, y)), M = x >= 0 ? x : x + 360, N = _ >= 0 ? _ : _ + 360, E = tu(M - N) > 180 ? (M + N + 360) / 2 : (M + N) / 2, j = 1 - .17 * ts(o(E - 30)) + .24 * ts(o(2 * E)) + .32 * ts(o(3 * E + 6)) - .2 * ts(o(4 * E - 63)), S = N - M;
                    S = 180 >= tu(S) ? S : N <= M ? S + 360 : S - 360, S = 2 * ta(v * w) * tc(o(S) / 2);
                    let R = w - v,
                        A = 1 + .015 * tl(h - 50, 2) / ta(20 + tl(h - 50, 2)),
                        P = 1 + .045 * k,
                        O = 1 + .015 * k * j,
                        L = 30 * td(-tl((E - 275) / 25, 2)),
                        D = -(2 * ta(tl(k, 7) / (tl(k, 7) + tl(25, 7)))) * tc(2 * o(L));
                    return tf(0, to(100, ta(tl((s - f) / (r * A), 2) + tl(R / (n * P), 2) + tl(S / (a * O), 2) + R / (n * P) * D * (S / (a * O)))))
                },
                distance: function(e, t, r = "lab") {
                    e = new m(e), t = new m(t);
                    let n = e.get(r),
                        a = t.get(r),
                        l = 0;
                    for (let e in n) {
                        let t = (n[e] || 0) - (a[e] || 0);
                        l += t * t
                    }
                    return Math.sqrt(l)
                },
                limits: tn,
                valid: (...e) => {
                    try {
                        return new m(...e), !0
                    } catch (e) {
                        return !1
                    }
                },
                scales: {
                    cool: () => eW([y.hsl(180, 1, .9), y.hsl(250, .7, .4)]),
                    hot: () => eW(["#000", "#f00", "#ff0", "#fff"], [0, .25, .75, 1]).mode("rgb")
                },
                input: p,
                colors: em,
                brewer: tb
            });
            var tg = y
        },
        14713: function(e, t, r) {
            "use strict";
            r.d(t, {
                ZP: function() {
                    return i
                }
            });
            var n = r(55185),
                a = r(3752),
                l = r(77755);
            let o = n.use || (e => {
                    if ("pending" === e.status) throw e;
                    if ("fulfilled" === e.status) return e.value;
                    if ("rejected" === e.status) throw e.reason;
                    throw e.status = "pending", e.then(t => {
                        e.status = "fulfilled", e.value = t
                    }, t => {
                        e.status = "rejected", e.reason = t
                    }), e
                }),
                f = {
                    dedupe: !0
                };
            l.$l.defineProperty(l.J$, "defaultValue", {
                value: l.u_
            });
            let i = (0, l.s6)((e, t, r) => {
                let {
                    cache: i,
                    compare: u,
                    suspense: s,
                    fallbackData: c,
                    revalidateOnMount: d,
                    revalidateIfStale: h,
                    refreshInterval: b,
                    refreshWhenHidden: g,
                    refreshWhenOffline: p,
                    keepPreviousData: m
                } = r, [y, v, w, k] = l.DY.get(i), [x, _] = (0, l.qC)(e), M = (0, n.useRef)(!1), N = (0, n.useRef)(!1), E = (0, n.useRef)(x), j = (0, n.useRef)(t), S = (0, n.useRef)(r), R = () => S.current, A = () => R().isVisible() && R().isOnline(), [P, O, L, D] = (0, l.JN)(i, x), C = (0, n.useRef)({}).current, T = (0, l.o8)(c) ? r.fallback[x] : c, V = (e, t) => {
                    for (let r in C)
                        if ("data" === r) {
                            if (!u(e[r], t[r]) && (!(0, l.o8)(e[r]) || !u(F, t[r]))) return !1
                        } else if (t[r] !== e[r]) return !1;
                    return !0
                }, $ = (0, n.useMemo)(() => {
                    let e = !!x && !!t && ((0, l.o8)(d) ? !R().isPaused() && !s && (!!(0, l.o8)(h) || h) : d),
                        r = t => {
                            let r = (0, l.PM)(t);
                            return (delete r._k, e) ? {
                                isValidating: !0,
                                isLoading: !0,
                                ...r
                            } : r
                        },
                        n = P(),
                        a = D(),
                        o = r(n),
                        f = n === a ? o : r(a),
                        i = o;
                    return [() => {
                        let e = r(P());
                        return V(e, i) ? (i.data = e.data, i.isLoading = e.isLoading, i.isValidating = e.isValidating, i.error = e.error, i) : (i = e, e)
                    }, () => f]
                }, [i, x]), I = (0, a.useSyncExternalStore)((0, n.useCallback)(e => L(x, (t, r) => {
                    V(r, t) || e()
                }), [i, x]), $[0], $[1]), q = !M.current, B = y[x] && y[x].length > 0, G = I.data, Y = (0, l.o8)(G) ? T : G, z = I.error, U = (0, n.useRef)(Y), F = m ? (0, l.o8)(G) ? U.current : G : Y, K = (!B || !!(0, l.o8)(z)) && (q && !(0, l.o8)(d) ? d : !R().isPaused() && (s ? !(0, l.o8)(Y) && h : (0, l.o8)(Y) || h)), X = !!(x && t && q && K), Z = (0, l.o8)(I.isValidating) ? X : I.isValidating, H = (0, l.o8)(I.isLoading) ? X : I.isLoading, W = (0, n.useCallback)(async e => {
                    let t, n;
                    let a = j.current;
                    if (!x || !a || N.current || R().isPaused()) return !1;
                    let o = !0,
                        f = e || {},
                        i = !w[x] || !f.dedupe,
                        s = () => l.w6 ? !N.current && x === E.current && M.current : x === E.current,
                        c = {
                            isValidating: !1,
                            isLoading: !1
                        },
                        d = () => {
                            O(c)
                        },
                        h = () => {
                            let e = w[x];
                            e && e[1] === n && delete w[x]
                        },
                        b = {
                            isValidating: !0
                        };
                    (0, l.o8)(P().data) && (b.isLoading = !0);
                    try {
                        if (i && (O(b), r.loadingTimeout && (0, l.o8)(P().data) && setTimeout(() => {
                                o && s() && R().onLoadingSlow(x, r)
                            }, r.loadingTimeout), w[x] = [a(_), (0, l.u3)()]), [t, n] = w[x], t = await t, i && setTimeout(h, r.dedupingInterval), !w[x] || w[x][1] !== n) return i && s() && R().onDiscarded(x), !1;
                        c.error = l.i_;
                        let e = v[x];
                        if (!(0, l.o8)(e) && (n <= e[0] || n <= e[1] || 0 === e[1])) return d(), i && s() && R().onDiscarded(x), !1;
                        let f = P().data;
                        c.data = u(f, t) ? f : t, i && s() && R().onSuccess(t, x, r)
                    } catch (r) {
                        h();
                        let e = R(),
                            {
                                shouldRetryOnError: t
                            } = e;
                        !e.isPaused() && (c.error = r, i && s() && (e.onError(r, x, e), (!0 === t || (0, l.mf)(t) && t(r)) && (!R().revalidateOnFocus || !R().revalidateOnReconnect || A()) && e.onErrorRetry(r, x, e, e => {
                            let t = y[x];
                            t && t[0] && t[0](l.sj.ERROR_REVALIDATE_EVENT, e)
                        }, {
                            retryCount: (f.retryCount || 0) + 1,
                            dedupe: !0
                        })))
                    }
                    return o = !1, d(), !0
                }, [x, i]), J = (0, n.useCallback)((...e) => (0, l.BN)(i, E.current, ...e), []);
                if ((0, l.LI)(() => {
                        j.current = t, S.current = r, (0, l.o8)(G) || (U.current = G)
                    }), (0, l.LI)(() => {
                        if (!x) return;
                        let e = W.bind(l.i_, f),
                            t = 0,
                            r = (0, l.ko)(x, y, (r, n = {}) => {
                                if (r == l.sj.FOCUS_EVENT) {
                                    let r = Date.now();
                                    R().revalidateOnFocus && r > t && A() && (t = r + R().focusThrottleInterval, e())
                                } else if (r == l.sj.RECONNECT_EVENT) R().revalidateOnReconnect && A() && e();
                                else if (r == l.sj.MUTATE_EVENT) return W();
                                else if (r == l.sj.ERROR_REVALIDATE_EVENT) return W(n)
                            });
                        return N.current = !1, E.current = x, M.current = !0, O({
                            _k: _
                        }), K && ((0, l.o8)(Y) || l.W6 ? e() : (0, l.kw)(e)), () => {
                            N.current = !0, r()
                        }
                    }, [x]), (0, l.LI)(() => {
                        let e;

                        function t() {
                            let t = (0, l.mf)(b) ? b(P().data) : b;
                            t && -1 !== e && (e = setTimeout(r, t))
                        }

                        function r() {
                            !P().error && (g || R().isVisible()) && (p || R().isOnline()) ? W(f).then(t) : t()
                        }
                        return t(), () => {
                            e && (clearTimeout(e), e = -1)
                        }
                    }, [b, g, p, x]), (0, n.useDebugValue)(F), s && (0, l.o8)(Y) && x) {
                    if (!l.w6 && l.W6) throw Error("Fallback data is required when using suspense in SSR.");
                    j.current = t, S.current = r, N.current = !1;
                    let e = k[x];
                    if ((0, l.o8)(e) || o(J(e)), (0, l.o8)(z)) {
                        let e = W(f);
                        (0, l.o8)(F) || (e.status = "fulfilled", e.value = !0), o(e)
                    } else throw z
                }
                return {
                    mutate: J,
                    get data() {
                        return C.data = !0, F
                    },
                    get error() {
                        return C.error = !0, z
                    },
                    get isValidating() {
                        return C.isValidating = !0, Z
                    },
                    get isLoading() {
                        return C.isLoading = !0, H
                    }
                }
            })
        }
    }
]);