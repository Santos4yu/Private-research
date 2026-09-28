"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [9819], {
        21994: function(e, t, n) {
            n.d(t, {
                CH: function() {
                    return i
                }
            }), n(81666), n(55185), n(14885);
            var r = n(69237),
                l = n(88242);
            n(13516), n(78946), n(22223), n(67533), n(16401), n(58988), n(29804), (0, l.JM)({
                packageName: "@clerk/nextjs"
            }), (0, l.Aw)("@clerk/nextjs");
            let i = r.CH;
            r.tj, r.Cv
        },
        53120: function(e, t, n) {
            let r;
            n.d(t, {
                LB: function() {
                    return eq
                },
                g4: function() {
                    return m
                },
                Lg: function() {
                    return ed
                },
                we: function() {
                    return em
                },
                LO: function() {
                    return ew
                },
                pE: function() {
                    return _
                },
                VK: function() {
                    return K
                },
                Cj: function() {
                    return eX
                },
                O1: function() {
                    return eW
                },
                Zj: function() {
                    return e$
                },
                VT: function() {
                    return P
                },
                Dy: function() {
                    return A
                }
            });
            var l, i, o, u, a, c, s, d, f, h, p, v, m, g, y, b, w, E, x, C = n(55185),
                k = n(19892),
                D = n(83357);
            let M = {
                display: "none"
            };

            function R(e) {
                let {
                    id: t,
                    value: n
                } = e;
                return C.createElement("div", {
                    id: t,
                    style: M
                }, n)
            }

            function S(e) {
                let {
                    id: t,
                    announcement: n,
                    ariaLiveType: r = "assertive"
                } = e;
                return C.createElement("div", {
                    id: t,
                    style: {
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: 1,
                        height: 1,
                        margin: -1,
                        border: 0,
                        padding: 0,
                        overflow: "hidden",
                        clip: "rect(0 0 0 0)",
                        clipPath: "inset(100%)",
                        whiteSpace: "nowrap"
                    },
                    role: "status",
                    "aria-live": r,
                    "aria-atomic": !0
                }, n)
            }
            let L = (0, C.createContext)(null),
                I = {
                    draggable: "\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  "
                },
                O = {
                    onDragStart(e) {
                        let {
                            active: t
                        } = e;
                        return "Picked up draggable item " + t.id + "."
                    },
                    onDragOver(e) {
                        let {
                            active: t,
                            over: n
                        } = e;
                        return n ? "Draggable item " + t.id + " was moved over droppable area " + n.id + "." : "Draggable item " + t.id + " is no longer over a droppable area."
                    },
                    onDragEnd(e) {
                        let {
                            active: t,
                            over: n
                        } = e;
                        return n ? "Draggable item " + t.id + " was dropped over droppable area " + n.id : "Draggable item " + t.id + " was dropped."
                    },
                    onDragCancel(e) {
                        let {
                            active: t
                        } = e;
                        return "Dragging was cancelled. Draggable item " + t.id + " was dropped."
                    }
                };

            function T(e) {
                let {
                    announcements: t = O,
                    container: n,
                    hiddenTextDescribedById: r,
                    screenReaderInstructions: l = I
                } = e, {
                    announce: i,
                    announcement: o
                } = function() {
                    let [e, t] = (0, C.useState)("");
                    return {
                        announce: (0, C.useCallback)(e => {
                            null != e && t(e)
                        }, []),
                        announcement: e
                    }
                }(), u = (0, D.Ld)("DndLiveRegion"), [a, c] = (0, C.useState)(!1);
                if ((0, C.useEffect)(() => {
                        c(!0)
                    }, []), ! function(e) {
                        let t = (0, C.useContext)(L);
                        (0, C.useEffect)(() => {
                            if (!t) throw Error("useDndMonitor must be used within a children of <DndContext>");
                            return t(e)
                        }, [e, t])
                    }((0, C.useMemo)(() => ({
                        onDragStart(e) {
                            let {
                                active: n
                            } = e;
                            i(t.onDragStart({
                                active: n
                            }))
                        },
                        onDragMove(e) {
                            let {
                                active: n,
                                over: r
                            } = e;
                            t.onDragMove && i(t.onDragMove({
                                active: n,
                                over: r
                            }))
                        },
                        onDragOver(e) {
                            let {
                                active: n,
                                over: r
                            } = e;
                            i(t.onDragOver({
                                active: n,
                                over: r
                            }))
                        },
                        onDragEnd(e) {
                            let {
                                active: n,
                                over: r
                            } = e;
                            i(t.onDragEnd({
                                active: n,
                                over: r
                            }))
                        },
                        onDragCancel(e) {
                            let {
                                active: n,
                                over: r
                            } = e;
                            i(t.onDragCancel({
                                active: n,
                                over: r
                            }))
                        }
                    }), [i, t])), !a) return null;
                let s = C.createElement(C.Fragment, null, C.createElement(R, {
                    id: r,
                    value: l.draggable
                }), C.createElement(S, {
                    id: u,
                    announcement: o
                }));
                return n ? (0, k.createPortal)(s, n) : s
            }

            function N() {}

            function P(e, t) {
                return (0, C.useMemo)(() => ({
                    sensor: e,
                    options: null != t ? t : {}
                }), [e, t])
            }

            function A() {
                for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n];
                return (0, C.useMemo)(() => [...t].filter(e => null != e), [...t])
            }(l = h || (h = {})).DragStart = "dragStart", l.DragMove = "dragMove", l.DragEnd = "dragEnd", l.DragCancel = "dragCancel", l.DragOver = "dragOver", l.RegisterDroppable = "registerDroppable", l.SetDroppableDisabled = "setDroppableDisabled", l.UnregisterDroppable = "unregisterDroppable";
            let F = Object.freeze({
                x: 0,
                y: 0
            });

            function j(e, t) {
                let {
                    data: {
                        value: n
                    }
                } = e, {
                    data: {
                        value: r
                    }
                } = t;
                return n - r
            }

            function Z(e, t) {
                let {
                    data: {
                        value: n
                    }
                } = e, {
                    data: {
                        value: r
                    }
                } = t;
                return r - n
            }

            function z(e, t, n) {
                return void 0 === t && (t = e.left), void 0 === n && (n = e.top), {
                    x: t + .5 * e.width,
                    y: n + .5 * e.height
                }
            }
            let _ = e => {
                    let {
                        collisionRect: t,
                        droppableRects: n,
                        droppableContainers: r
                    } = e, l = z(t, t.left, t.top), i = [];
                    for (let e of r) {
                        let {
                            id: t
                        } = e, r = n.get(t);
                        if (r) {
                            var o;
                            let n = Math.sqrt(Math.pow((o = z(r)).x - l.x, 2) + Math.pow(o.y - l.y, 2));
                            i.push({
                                id: t,
                                data: {
                                    droppableContainer: e,
                                    value: n
                                }
                            })
                        }
                    }
                    return i.sort(j)
                },
                B = e => {
                    let {
                        collisionRect: t,
                        droppableRects: n,
                        droppableContainers: r
                    } = e, l = [];
                    for (let e of r) {
                        let {
                            id: r
                        } = e, i = n.get(r);
                        if (i) {
                            let n = function(e, t) {
                                let n = Math.max(t.top, e.top),
                                    r = Math.max(t.left, e.left),
                                    l = Math.min(t.left + t.width, e.left + e.width),
                                    i = Math.min(t.top + t.height, e.top + e.height);
                                if (r < l && n < i) {
                                    let o = t.width * t.height,
                                        u = e.width * e.height,
                                        a = (l - r) * (i - n);
                                    return Number((a / (o + u - a)).toFixed(4))
                                }
                                return 0
                            }(i, t);
                            n > 0 && l.push({
                                id: r,
                                data: {
                                    droppableContainer: e,
                                    value: n
                                }
                            })
                        }
                    }
                    return l.sort(Z)
                };

            function U(e, t) {
                return e && t ? {
                    x: e.left - t.left,
                    y: e.top - t.top
                } : F
            }
            let q = function(e) {
                    for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) n[r - 1] = arguments[r];
                    return n.reduce((e, t) => ({ ...e,
                        top: e.top + 1 * t.y,
                        bottom: e.bottom + 1 * t.y,
                        left: e.left + 1 * t.x,
                        right: e.right + 1 * t.x
                    }), { ...e
                    })
                },
                H = {
                    ignoreTransform: !1
                };

            function K(e, t) {
                void 0 === t && (t = H);
                let n = e.getBoundingClientRect();
                if (t.ignoreTransform) {
                    let {
                        transform: t,
                        transformOrigin: r
                    } = (0, D.Jj)(e).getComputedStyle(e);
                    t && (n = function(e, t, n) {
                        let r = function(e) {
                            if (e.startsWith("matrix3d(")) {
                                let t = e.slice(9, -1).split(/, /);
                                return {
                                    x: +t[12],
                                    y: +t[13],
                                    scaleX: +t[0],
                                    scaleY: +t[5]
                                }
                            }
                            if (e.startsWith("matrix(")) {
                                let t = e.slice(7, -1).split(/, /);
                                return {
                                    x: +t[4],
                                    y: +t[5],
                                    scaleX: +t[0],
                                    scaleY: +t[3]
                                }
                            }
                            return null
                        }(t);
                        if (!r) return e;
                        let {
                            scaleX: l,
                            scaleY: i,
                            x: o,
                            y: u
                        } = r, a = e.left - o - (1 - l) * parseFloat(n), c = e.top - u - (1 - i) * parseFloat(n.slice(n.indexOf(" ") + 1)), s = l ? e.width / l : e.width, d = i ? e.height / i : e.height;
                        return {
                            width: s,
                            height: d,
                            top: c,
                            right: a + s,
                            bottom: c + d,
                            left: a
                        }
                    }(n, t, r))
                }
                let {
                    top: r,
                    left: l,
                    width: i,
                    height: o,
                    bottom: u,
                    right: a
                } = n;
                return {
                    top: r,
                    left: l,
                    width: i,
                    height: o,
                    bottom: u,
                    right: a
                }
            }

            function W(e) {
                return K(e, {
                    ignoreTransform: !0
                })
            }

            function X(e, t) {
                let n = [];
                return e ? function r(l) {
                    var i;
                    if (null != t && n.length >= t || !l) return n;
                    if ((0, D.qk)(l) && null != l.scrollingElement && !n.includes(l.scrollingElement)) return n.push(l.scrollingElement), n;
                    if (!(0, D.Re)(l) || (0, D.vZ)(l) || n.includes(l)) return n;
                    let o = (0, D.Jj)(e).getComputedStyle(l);
                    return (l !== e && function(e, t) {
                        void 0 === t && (t = (0, D.Jj)(e).getComputedStyle(e));
                        let n = /(auto|scroll|overlay)/;
                        return ["overflow", "overflowX", "overflowY"].some(e => {
                            let r = t[e];
                            return "string" == typeof r && n.test(r)
                        })
                    }(l, o) && n.push(l), void 0 === (i = o) && (i = (0, D.Jj)(l).getComputedStyle(l)), "fixed" === i.position) ? n : r(l.parentNode)
                }(e) : n
            }

            function V(e) {
                let [t] = X(e, 1);
                return null != t ? t : null
            }

            function $(e) {
                return D.Nq && e ? (0, D.FJ)(e) ? e : (0, D.UG)(e) ? (0, D.qk)(e) || e === (0, D.r3)(e).scrollingElement ? window : (0, D.Re)(e) ? e : null : null : null
            }

            function Y(e) {
                return (0, D.FJ)(e) ? e.scrollX : e.scrollLeft
            }

            function J(e) {
                return (0, D.FJ)(e) ? e.scrollY : e.scrollTop
            }

            function G(e) {
                return {
                    x: Y(e),
                    y: J(e)
                }
            }

            function Q(e) {
                return !!D.Nq && !!e && e === document.scrollingElement
            }

            function ee(e) {
                let t = {
                        x: 0,
                        y: 0
                    },
                    n = Q(e) ? {
                        height: window.innerHeight,
                        width: window.innerWidth
                    } : {
                        height: e.clientHeight,
                        width: e.clientWidth
                    },
                    r = {
                        x: e.scrollWidth - n.width,
                        y: e.scrollHeight - n.height
                    },
                    l = e.scrollTop <= t.y;
                return {
                    isTop: l,
                    isLeft: e.scrollLeft <= t.x,
                    isBottom: e.scrollTop >= r.y,
                    isRight: e.scrollLeft >= r.x,
                    maxScroll: r,
                    minScroll: t
                }
            }(i = p || (p = {}))[i.Forward = 1] = "Forward", i[i.Backward = -1] = "Backward";
            let et = {
                x: .2,
                y: .2
            };

            function en(e) {
                return e.reduce((e, t) => (0, D.IH)(e, G(t)), F)
            }
            let er = [
                ["x", ["left", "right"], function(e) {
                    return e.reduce((e, t) => e + Y(t), 0)
                }],
                ["y", ["top", "bottom"], function(e) {
                    return e.reduce((e, t) => e + J(t), 0)
                }]
            ];
            class el {
                constructor(e, t) {
                    this.rect = void 0, this.width = void 0, this.height = void 0, this.top = void 0, this.bottom = void 0, this.right = void 0, this.left = void 0;
                    let n = X(t),
                        r = en(n);
                    for (let [t, l, i] of (this.rect = { ...e
                        }, this.width = e.width, this.height = e.height, er))
                        for (let e of l) Object.defineProperty(this, e, {
                            get: () => {
                                let l = i(n),
                                    o = r[t] - l;
                                return this.rect[e] + o
                            },
                            enumerable: !0
                        });
                    Object.defineProperty(this, "rect", {
                        enumerable: !1
                    })
                }
            }
            class ei {
                constructor(e) {
                    this.target = void 0, this.listeners = [], this.removeAll = () => {
                        this.listeners.forEach(e => {
                            var t;
                            return null == (t = this.target) ? void 0 : t.removeEventListener(...e)
                        })
                    }, this.target = e
                }
                add(e, t, n) {
                    var r;
                    null == (r = this.target) || r.addEventListener(e, t, n), this.listeners.push([e, t, n])
                }
            }

            function eo(e, t) {
                let n = Math.abs(e.x),
                    r = Math.abs(e.y);
                return "number" == typeof t ? Math.sqrt(n ** 2 + r ** 2) > t : "x" in t && "y" in t ? n > t.x && r > t.y : "x" in t ? n > t.x : "y" in t && r > t.y
            }

            function eu(e) {
                e.preventDefault()
            }

            function ea(e) {
                e.stopPropagation()
            }(o = v || (v = {})).Click = "click", o.DragStart = "dragstart", o.Keydown = "keydown", o.ContextMenu = "contextmenu", o.Resize = "resize", o.SelectionChange = "selectionchange", o.VisibilityChange = "visibilitychange", (u = m || (m = {})).Space = "Space", u.Down = "ArrowDown", u.Right = "ArrowRight", u.Left = "ArrowLeft", u.Up = "ArrowUp", u.Esc = "Escape", u.Enter = "Enter", u.Tab = "Tab";
            let ec = {
                    start: [m.Space, m.Enter],
                    cancel: [m.Esc],
                    end: [m.Space, m.Enter, m.Tab]
                },
                es = (e, t) => {
                    let {
                        currentCoordinates: n
                    } = t;
                    switch (e.code) {
                        case m.Right:
                            return { ...n,
                                x: n.x + 25
                            };
                        case m.Left:
                            return { ...n,
                                x: n.x - 25
                            };
                        case m.Down:
                            return { ...n,
                                y: n.y + 25
                            };
                        case m.Up:
                            return { ...n,
                                y: n.y - 25
                            }
                    }
                };
            class ed {
                constructor(e) {
                    this.props = void 0, this.autoScrollEnabled = !1, this.referenceCoordinates = void 0, this.listeners = void 0, this.windowListeners = void 0, this.props = e;
                    let {
                        event: {
                            target: t
                        }
                    } = e;
                    this.props = e, this.listeners = new ei((0, D.r3)(t)), this.windowListeners = new ei((0, D.Jj)(t)), this.handleKeyDown = this.handleKeyDown.bind(this), this.handleCancel = this.handleCancel.bind(this), this.attach()
                }
                attach() {
                    this.handleStart(), this.windowListeners.add(v.Resize, this.handleCancel), this.windowListeners.add(v.VisibilityChange, this.handleCancel), setTimeout(() => this.listeners.add(v.Keydown, this.handleKeyDown))
                }
                handleStart() {
                    let {
                        activeNode: e,
                        onStart: t
                    } = this.props, n = e.node.current;
                    n && function(e, t) {
                        if (void 0 === t && (t = K), !e) return;
                        let {
                            top: n,
                            left: r,
                            bottom: l,
                            right: i
                        } = t(e);
                        V(e) && (l <= 0 || i <= 0 || n >= window.innerHeight || r >= window.innerWidth) && e.scrollIntoView({
                            block: "center",
                            inline: "center"
                        })
                    }(n), t(F)
                }
                handleKeyDown(e) {
                    if ((0, D.vd)(e)) {
                        let {
                            active: t,
                            context: n,
                            options: r
                        } = this.props, {
                            keyboardCodes: l = ec,
                            coordinateGetter: i = es,
                            scrollBehavior: o = "smooth"
                        } = r, {
                            code: u
                        } = e;
                        if (l.end.includes(u)) {
                            this.handleEnd(e);
                            return
                        }
                        if (l.cancel.includes(u)) {
                            this.handleCancel(e);
                            return
                        }
                        let {
                            collisionRect: a
                        } = n.current, c = a ? {
                            x: a.left,
                            y: a.top
                        } : F;
                        this.referenceCoordinates || (this.referenceCoordinates = c);
                        let s = i(e, {
                            active: t,
                            context: n.current,
                            currentCoordinates: c
                        });
                        if (s) {
                            let t = (0, D.$X)(s, c),
                                r = {
                                    x: 0,
                                    y: 0
                                },
                                {
                                    scrollableAncestors: l
                                } = n.current;
                            for (let n of l) {
                                let l = e.code,
                                    {
                                        isTop: i,
                                        isRight: u,
                                        isLeft: a,
                                        isBottom: c,
                                        maxScroll: d,
                                        minScroll: f
                                    } = ee(n),
                                    h = function(e) {
                                        if (e === document.scrollingElement) {
                                            let {
                                                innerWidth: e,
                                                innerHeight: t
                                            } = window;
                                            return {
                                                top: 0,
                                                left: 0,
                                                right: e,
                                                bottom: t,
                                                width: e,
                                                height: t
                                            }
                                        }
                                        let {
                                            top: t,
                                            left: n,
                                            right: r,
                                            bottom: l
                                        } = e.getBoundingClientRect();
                                        return {
                                            top: t,
                                            left: n,
                                            right: r,
                                            bottom: l,
                                            width: e.clientWidth,
                                            height: e.clientHeight
                                        }
                                    }(n),
                                    p = {
                                        x: Math.min(l === m.Right ? h.right - h.width / 2 : h.right, Math.max(l === m.Right ? h.left : h.left + h.width / 2, s.x)),
                                        y: Math.min(l === m.Down ? h.bottom - h.height / 2 : h.bottom, Math.max(l === m.Down ? h.top : h.top + h.height / 2, s.y))
                                    },
                                    v = l === m.Right && !u || l === m.Left && !a,
                                    g = l === m.Down && !c || l === m.Up && !i;
                                if (v && p.x !== s.x) {
                                    let e = n.scrollLeft + t.x,
                                        i = l === m.Right && e <= d.x || l === m.Left && e >= f.x;
                                    if (i && !t.y) {
                                        n.scrollTo({
                                            left: e,
                                            behavior: o
                                        });
                                        return
                                    }
                                    i ? r.x = n.scrollLeft - e : r.x = l === m.Right ? n.scrollLeft - d.x : n.scrollLeft - f.x, r.x && n.scrollBy({
                                        left: -r.x,
                                        behavior: o
                                    });
                                    break
                                }
                                if (g && p.y !== s.y) {
                                    let e = n.scrollTop + t.y,
                                        i = l === m.Down && e <= d.y || l === m.Up && e >= f.y;
                                    if (i && !t.x) {
                                        n.scrollTo({
                                            top: e,
                                            behavior: o
                                        });
                                        return
                                    }
                                    i ? r.y = n.scrollTop - e : r.y = l === m.Down ? n.scrollTop - d.y : n.scrollTop - f.y, r.y && n.scrollBy({
                                        top: -r.y,
                                        behavior: o
                                    });
                                    break
                                }
                            }
                            this.handleMove(e, (0, D.IH)((0, D.$X)(s, this.referenceCoordinates), r))
                        }
                    }
                }
                handleMove(e, t) {
                    let {
                        onMove: n
                    } = this.props;
                    e.preventDefault(), n(t)
                }
                handleEnd(e) {
                    let {
                        onEnd: t
                    } = this.props;
                    e.preventDefault(), this.detach(), t()
                }
                handleCancel(e) {
                    let {
                        onCancel: t
                    } = this.props;
                    e.preventDefault(), this.detach(), t()
                }
                detach() {
                    this.listeners.removeAll(), this.windowListeners.removeAll()
                }
            }

            function ef(e) {
                return !!(e && "distance" in e)
            }

            function eh(e) {
                return !!(e && "delay" in e)
            }
            ed.activators = [{
                eventName: "onKeyDown",
                handler: (e, t, n) => {
                    let {
                        keyboardCodes: r = ec,
                        onActivation: l
                    } = t, {
                        active: i
                    } = n, {
                        code: o
                    } = e.nativeEvent;
                    if (r.start.includes(o)) {
                        let t = i.activatorNode.current;
                        return (!t || e.target === t) && (e.preventDefault(), null == l || l({
                            event: e.nativeEvent
                        }), !0)
                    }
                    return !1
                }
            }];
            class ep {
                constructor(e, t, n) {
                    var r;
                    void 0 === n && (n = function(e) {
                        let {
                            EventTarget: t
                        } = (0, D.Jj)(e);
                        return e instanceof t ? e : (0, D.r3)(e)
                    }(e.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = !0, this.document = void 0, this.activated = !1, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = e, this.events = t;
                    let {
                        event: l
                    } = e, {
                        target: i
                    } = l;
                    this.props = e, this.events = t, this.document = (0, D.r3)(i), this.documentListeners = new ei(this.document), this.listeners = new ei(n), this.windowListeners = new ei((0, D.Jj)(i)), this.initialCoordinates = null != (r = (0, D.DC)(l)) ? r : F, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach()
                }
                attach() {
                    let {
                        events: e,
                        props: {
                            options: {
                                activationConstraint: t,
                                bypassActivationConstraint: n
                            }
                        }
                    } = this;
                    if (this.listeners.add(e.move.name, this.handleMove, {
                            passive: !1
                        }), this.listeners.add(e.end.name, this.handleEnd), e.cancel && this.listeners.add(e.cancel.name, this.handleCancel), this.windowListeners.add(v.Resize, this.handleCancel), this.windowListeners.add(v.DragStart, eu), this.windowListeners.add(v.VisibilityChange, this.handleCancel), this.windowListeners.add(v.ContextMenu, eu), this.documentListeners.add(v.Keydown, this.handleKeydown), t) {
                        if (null != n && n({
                                event: this.props.event,
                                activeNode: this.props.activeNode,
                                options: this.props.options
                            })) return this.handleStart();
                        if (eh(t)) {
                            this.timeoutId = setTimeout(this.handleStart, t.delay), this.handlePending(t);
                            return
                        }
                        if (ef(t)) {
                            this.handlePending(t);
                            return
                        }
                    }
                    this.handleStart()
                }
                detach() {
                    this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), null !== this.timeoutId && (clearTimeout(this.timeoutId), this.timeoutId = null)
                }
                handlePending(e, t) {
                    let {
                        active: n,
                        onPending: r
                    } = this.props;
                    r(n, e, this.initialCoordinates, t)
                }
                handleStart() {
                    let {
                        initialCoordinates: e
                    } = this, {
                        onStart: t
                    } = this.props;
                    e && (this.activated = !0, this.documentListeners.add(v.Click, ea, {
                        capture: !0
                    }), this.removeTextSelection(), this.documentListeners.add(v.SelectionChange, this.removeTextSelection), t(e))
                }
                handleMove(e) {
                    var t;
                    let {
                        activated: n,
                        initialCoordinates: r,
                        props: l
                    } = this, {
                        onMove: i,
                        options: {
                            activationConstraint: o
                        }
                    } = l;
                    if (!r) return;
                    let u = null != (t = (0, D.DC)(e)) ? t : F,
                        a = (0, D.$X)(r, u);
                    if (!n && o) {
                        if (ef(o)) {
                            if (null != o.tolerance && eo(a, o.tolerance)) return this.handleCancel();
                            if (eo(a, o.distance)) return this.handleStart()
                        }
                        return eh(o) && eo(a, o.tolerance) ? this.handleCancel() : void this.handlePending(o, a)
                    }
                    e.cancelable && e.preventDefault(), i(u)
                }
                handleEnd() {
                    let {
                        onAbort: e,
                        onEnd: t
                    } = this.props;
                    this.detach(), this.activated || e(this.props.active), t()
                }
                handleCancel() {
                    let {
                        onAbort: e,
                        onCancel: t
                    } = this.props;
                    this.detach(), this.activated || e(this.props.active), t()
                }
                handleKeydown(e) {
                    e.code === m.Esc && this.handleCancel()
                }
                removeTextSelection() {
                    var e;
                    null == (e = this.document.getSelection()) || e.removeAllRanges()
                }
            }
            let ev = {
                cancel: {
                    name: "pointercancel"
                },
                move: {
                    name: "pointermove"
                },
                end: {
                    name: "pointerup"
                }
            };
            class em extends ep {
                constructor(e) {
                    let {
                        event: t
                    } = e;
                    super(e, ev, (0, D.r3)(t.target))
                }
            }
            em.activators = [{
                eventName: "onPointerDown",
                handler: (e, t) => {
                    let {
                        nativeEvent: n
                    } = e, {
                        onActivation: r
                    } = t;
                    return !!n.isPrimary && 0 === n.button && (null == r || r({
                        event: n
                    }), !0)
                }
            }];
            let eg = {
                move: {
                    name: "mousemove"
                },
                end: {
                    name: "mouseup"
                }
            };
            (a = g || (g = {}))[a.RightClick = 2] = "RightClick";
            class ey extends ep {
                constructor(e) {
                    super(e, eg, (0, D.r3)(e.event.target))
                }
            }
            ey.activators = [{
                eventName: "onMouseDown",
                handler: (e, t) => {
                    let {
                        nativeEvent: n
                    } = e, {
                        onActivation: r
                    } = t;
                    return n.button !== g.RightClick && (null == r || r({
                        event: n
                    }), !0)
                }
            }];
            let eb = {
                cancel: {
                    name: "touchcancel"
                },
                move: {
                    name: "touchmove"
                },
                end: {
                    name: "touchend"
                }
            };
            class ew extends ep {
                constructor(e) {
                    super(e, eb)
                }
                static setup() {
                    return window.addEventListener(eb.move.name, e, {
                            capture: !1,
                            passive: !1
                        }),
                        function() {
                            window.removeEventListener(eb.move.name, e)
                        };

                    function e() {}
                }
            }
            ew.activators = [{
                eventName: "onTouchStart",
                handler: (e, t) => {
                    let {
                        nativeEvent: n
                    } = e, {
                        onActivation: r
                    } = t, {
                        touches: l
                    } = n;
                    return !(l.length > 1) && (null == r || r({
                        event: n
                    }), !0)
                }
            }], (c = y || (y = {}))[c.Pointer = 0] = "Pointer", c[c.DraggableRect = 1] = "DraggableRect", (s = b || (b = {}))[s.TreeOrder = 0] = "TreeOrder", s[s.ReversedTreeOrder = 1] = "ReversedTreeOrder";
            let eE = {
                x: {
                    [p.Backward]: !1,
                    [p.Forward]: !1
                },
                y: {
                    [p.Backward]: !1,
                    [p.Forward]: !1
                }
            };
            (d = w || (w = {}))[d.Always = 0] = "Always", d[d.BeforeDragging = 1] = "BeforeDragging", d[d.WhileDragging = 2] = "WhileDragging", (E || (E = {})).Optimized = "optimized";
            let ex = new Map;

            function eC(e, t) {
                return (0, D.Gj)(n => e ? n || ("function" == typeof t ? t(e) : e) : null, [t, e])
            }

            function ek(e) {
                let {
                    callback: t,
                    disabled: n
                } = e, r = (0, D.zX)(t), l = (0, C.useMemo)(() => {
                    if (n || "undefined" == typeof window || void 0 === window.ResizeObserver) return;
                    let {
                        ResizeObserver: e
                    } = window;
                    return new e(r)
                }, [n]);
                return (0, C.useEffect)(() => () => null == l ? void 0 : l.disconnect(), [l]), l
            }

            function eD(e) {
                return new el(K(e), e)
            }

            function eM(e, t, n) {
                void 0 === t && (t = eD);
                let [r, l] = (0, C.useState)(null);

                function i() {
                    l(r => {
                        if (!e) return null;
                        if (!1 === e.isConnected) {
                            var l;
                            return null != (l = null != r ? r : n) ? l : null
                        }
                        let i = t(e);
                        return JSON.stringify(r) === JSON.stringify(i) ? r : i
                    })
                }
                let o = function(e) {
                        let {
                            callback: t,
                            disabled: n
                        } = e, r = (0, D.zX)(t), l = (0, C.useMemo)(() => {
                            if (n || "undefined" == typeof window || void 0 === window.MutationObserver) return;
                            let {
                                MutationObserver: e
                            } = window;
                            return new e(r)
                        }, [r, n]);
                        return (0, C.useEffect)(() => () => null == l ? void 0 : l.disconnect(), [l]), l
                    }({
                        callback(t) {
                            if (e)
                                for (let n of t) {
                                    let {
                                        type: t,
                                        target: r
                                    } = n;
                                    if ("childList" === t && r instanceof HTMLElement && r.contains(e)) {
                                        i();
                                        break
                                    }
                                }
                        }
                    }),
                    u = ek({
                        callback: i
                    });
                return (0, D.LI)(() => {
                    i(), e ? (null == u || u.observe(e), null == o || o.observe(document.body, {
                        childList: !0,
                        subtree: !0
                    })) : (null == u || u.disconnect(), null == o || o.disconnect())
                }, [e]), r
            }
            let eR = [];

            function eS(e, t) {
                void 0 === t && (t = []);
                let n = (0, C.useRef)(null);
                return (0, C.useEffect)(() => {
                    n.current = null
                }, t), (0, C.useEffect)(() => {
                    let t = e !== F;
                    t && !n.current && (n.current = e), !t && n.current && (n.current = null)
                }, [e]), n.current ? (0, D.$X)(e, n.current) : F
            }

            function eL(e) {
                return (0, C.useMemo)(() => e ? function(e) {
                    let t = e.innerWidth,
                        n = e.innerHeight;
                    return {
                        top: 0,
                        left: 0,
                        right: t,
                        bottom: n,
                        width: t,
                        height: n
                    }
                }(e) : null, [e])
            }
            let eI = [],
                eO = [{
                    sensor: em,
                    options: {}
                }, {
                    sensor: ed,
                    options: {}
                }],
                eT = {
                    current: {}
                },
                eN = {
                    draggable: {
                        measure: W
                    },
                    droppable: {
                        measure: W,
                        strategy: w.WhileDragging,
                        frequency: E.Optimized
                    },
                    dragOverlay: {
                        measure: K
                    }
                };
            class eP extends Map {
                get(e) {
                    var t;
                    return null != e && null != (t = super.get(e)) ? t : void 0
                }
                toArray() {
                    return Array.from(this.values())
                }
                getEnabled() {
                    return this.toArray().filter(e => {
                        let {
                            disabled: t
                        } = e;
                        return !t
                    })
                }
                getNodeFor(e) {
                    var t, n;
                    return null != (t = null == (n = this.get(e)) ? void 0 : n.node.current) ? t : void 0
                }
            }
            let eA = {
                    activatorEvent: null,
                    active: null,
                    activeNode: null,
                    activeNodeRect: null,
                    collisions: null,
                    containerNodeRect: null,
                    draggableNodes: new Map,
                    droppableRects: new Map,
                    droppableContainers: new eP,
                    over: null,
                    dragOverlay: {
                        nodeRef: {
                            current: null
                        },
                        rect: null,
                        setRef: N
                    },
                    scrollableAncestors: [],
                    scrollableAncestorRects: [],
                    measuringConfiguration: eN,
                    measureDroppableContainers: N,
                    windowRect: null,
                    measuringScheduled: !1
                },
                eF = {
                    activatorEvent: null,
                    activators: [],
                    active: null,
                    activeNodeRect: null,
                    ariaDescribedById: {
                        draggable: ""
                    },
                    dispatch: N,
                    draggableNodes: new Map,
                    over: null,
                    measureDroppableContainers: N
                },
                ej = (0, C.createContext)(eF),
                eZ = (0, C.createContext)(eA);

            function ez() {
                return {
                    draggable: {
                        active: null,
                        initialCoordinates: {
                            x: 0,
                            y: 0
                        },
                        nodes: new Map,
                        translate: {
                            x: 0,
                            y: 0
                        }
                    },
                    droppable: {
                        containers: new eP
                    }
                }
            }

            function e_(e, t) {
                switch (t.type) {
                    case h.DragStart:
                        return { ...e,
                            draggable: { ...e.draggable,
                                initialCoordinates: t.initialCoordinates,
                                active: t.active
                            }
                        };
                    case h.DragMove:
                        if (null == e.draggable.active) return e;
                        return { ...e,
                            draggable: { ...e.draggable,
                                translate: {
                                    x: t.coordinates.x - e.draggable.initialCoordinates.x,
                                    y: t.coordinates.y - e.draggable.initialCoordinates.y
                                }
                            }
                        };
                    case h.DragEnd:
                    case h.DragCancel:
                        return { ...e,
                            draggable: { ...e.draggable,
                                active: null,
                                initialCoordinates: {
                                    x: 0,
                                    y: 0
                                },
                                translate: {
                                    x: 0,
                                    y: 0
                                }
                            }
                        };
                    case h.RegisterDroppable:
                        {
                            let {
                                element: n
                            } = t,
                            {
                                id: r
                            } = n,
                            l = new eP(e.droppable.containers);
                            return l.set(r, n),
                            { ...e,
                                droppable: { ...e.droppable,
                                    containers: l
                                }
                            }
                        }
                    case h.SetDroppableDisabled:
                        {
                            let {
                                id: n,
                                key: r,
                                disabled: l
                            } = t,
                            i = e.droppable.containers.get(n);
                            if (!i || r !== i.key) return e;
                            let o = new eP(e.droppable.containers);
                            return o.set(n, { ...i,
                                disabled: l
                            }),
                            { ...e,
                                droppable: { ...e.droppable,
                                    containers: o
                                }
                            }
                        }
                    case h.UnregisterDroppable:
                        {
                            let {
                                id: n,
                                key: r
                            } = t,
                            l = e.droppable.containers.get(n);
                            if (!l || r !== l.key) return e;
                            let i = new eP(e.droppable.containers);
                            return i.delete(n),
                            { ...e,
                                droppable: { ...e.droppable,
                                    containers: i
                                }
                            }
                        }
                    default:
                        return e
                }
            }

            function eB(e) {
                let {
                    disabled: t
                } = e, {
                    active: n,
                    activatorEvent: r,
                    draggableNodes: l
                } = (0, C.useContext)(ej), i = (0, D.D9)(r), o = (0, D.D9)(null == n ? void 0 : n.id);
                return (0, C.useEffect)(() => {
                    if (!t && !r && i && null != o) {
                        if (!(0, D.vd)(i) || document.activeElement === i.target) return;
                        let e = l.get(o);
                        if (!e) return;
                        let {
                            activatorNode: t,
                            node: n
                        } = e;
                        (t.current || n.current) && requestAnimationFrame(() => {
                            for (let e of [t.current, n.current]) {
                                if (!e) continue;
                                let t = (0, D.so)(e);
                                if (t) {
                                    t.focus();
                                    break
                                }
                            }
                        })
                    }
                }, [r, t, l, o, i]), null
            }
            let eU = (0, C.createContext)({ ...F,
                scaleX: 1,
                scaleY: 1
            });
            (f = x || (x = {}))[f.Uninitialized = 0] = "Uninitialized", f[f.Initializing = 1] = "Initializing", f[f.Initialized = 2] = "Initialized";
            let eq = (0, C.memo)(function(e) {
                    var t, n, r, l, i, o;
                    let {
                        id: u,
                        accessibility: a,
                        autoScroll: c = !0,
                        children: s,
                        sensors: d = eO,
                        collisionDetection: f = B,
                        measuring: v,
                        modifiers: m,
                        ...g
                    } = e, [E, M] = (0, C.useReducer)(e_, void 0, ez), [R, S] = function() {
                        let [e] = (0, C.useState)(() => new Set), t = (0, C.useCallback)(t => (e.add(t), () => e.delete(t)), [e]);
                        return [(0, C.useCallback)(t => {
                            let {
                                type: n,
                                event: r
                            } = t;
                            e.forEach(e => {
                                var t;
                                return null == (t = e[n]) ? void 0 : t.call(e, r)
                            })
                        }, [e]), t]
                    }(), [I, O] = (0, C.useState)(x.Uninitialized), N = I === x.Initialized, {
                        draggable: {
                            active: P,
                            nodes: A,
                            translate: j
                        },
                        droppable: {
                            containers: Z
                        }
                    } = E, z = null != P ? A.get(P) : null, _ = (0, C.useRef)({
                        initial: null,
                        translated: null
                    }), H = (0, C.useMemo)(() => {
                        var e;
                        return null != P ? {
                            id: P,
                            data: null != (e = null == z ? void 0 : z.data) ? e : eT,
                            rect: _
                        } : null
                    }, [P, z]), W = (0, C.useRef)(null), [Y, J] = (0, C.useState)(null), [er, ei] = (0, C.useState)(null), eo = (0, D.Ey)(g, Object.values(g)), eu = (0, D.Ld)("DndDescribedBy", u), ea = (0, C.useMemo)(() => Z.getEnabled(), [Z]), ec = (0, C.useMemo)(() => ({
                        draggable: { ...eN.draggable,
                            ...null == v ? void 0 : v.draggable
                        },
                        droppable: { ...eN.droppable,
                            ...null == v ? void 0 : v.droppable
                        },
                        dragOverlay: { ...eN.dragOverlay,
                            ...null == v ? void 0 : v.dragOverlay
                        }
                    }), [null == v ? void 0 : v.draggable, null == v ? void 0 : v.droppable, null == v ? void 0 : v.dragOverlay]), {
                        droppableRects: es,
                        measureDroppableContainers: ed,
                        measuringScheduled: ef
                    } = function(e, t) {
                        let {
                            dragging: n,
                            dependencies: r,
                            config: l
                        } = t, [i, o] = (0, C.useState)(null), {
                            frequency: u,
                            measure: a,
                            strategy: c
                        } = l, s = (0, C.useRef)(e), d = function() {
                            switch (c) {
                                case w.Always:
                                    return !1;
                                case w.BeforeDragging:
                                    return n;
                                default:
                                    return !n
                            }
                        }(), f = (0, D.Ey)(d), h = (0, C.useCallback)(function(e) {
                            void 0 === e && (e = []), f.current || o(t => null === t ? e : t.concat(e.filter(e => !t.includes(e))))
                        }, [f]), p = (0, C.useRef)(null), v = (0, D.Gj)(t => {
                            if (d && !n) return ex;
                            if (!t || t === ex || s.current !== e || null != i) {
                                let t = new Map;
                                for (let n of e) {
                                    if (!n) continue;
                                    if (i && i.length > 0 && !i.includes(n.id) && n.rect.current) {
                                        t.set(n.id, n.rect.current);
                                        continue
                                    }
                                    let e = n.node.current,
                                        r = e ? new el(a(e), e) : null;
                                    n.rect.current = r, r && t.set(n.id, r)
                                }
                                return t
                            }
                            return t
                        }, [e, i, n, d, a]);
                        return (0, C.useEffect)(() => {
                            s.current = e
                        }, [e]), (0, C.useEffect)(() => {
                            d || h()
                        }, [n, d]), (0, C.useEffect)(() => {
                            i && i.length > 0 && o(null)
                        }, [JSON.stringify(i)]), (0, C.useEffect)(() => {
                            d || "number" != typeof u || null !== p.current || (p.current = setTimeout(() => {
                                h(), p.current = null
                            }, u))
                        }, [u, d, h, ...r]), {
                            droppableRects: v,
                            measureDroppableContainers: h,
                            measuringScheduled: null != i
                        }
                    }(ea, {
                        dragging: N,
                        dependencies: [j.x, j.y],
                        config: ec.droppable
                    }), eh = function(e, t) {
                        let n = null != t ? e.get(t) : void 0,
                            r = n ? n.node.current : null;
                        return (0, D.Gj)(e => {
                            var n;
                            return null == t ? null : null != (n = null != r ? r : e) ? n : null
                        }, [r, t])
                    }(A, P), ep = (0, C.useMemo)(() => er ? (0, D.DC)(er) : null, [er]), ev = function() {
                        let e = (null == Y ? void 0 : Y.autoScrollEnabled) === !1,
                            t = "object" == typeof c ? !1 === c.enabled : !1 === c,
                            n = N && !e && !t;
                        return "object" == typeof c ? { ...c,
                            enabled: n
                        } : {
                            enabled: n
                        }
                    }(), em = eC(eh, ec.draggable.measure);
                    ! function(e) {
                        let {
                            activeNode: t,
                            measure: n,
                            initialRect: r,
                            config: l = !0
                        } = e, i = (0, C.useRef)(!1), {
                            x: o,
                            y: u
                        } = "boolean" == typeof l ? {
                            x: l,
                            y: l
                        } : l;
                        (0, D.LI)(() => {
                            if (!o && !u || !t) {
                                i.current = !1;
                                return
                            }
                            if (i.current || !r) return;
                            let e = null == t ? void 0 : t.node.current;
                            if (!e || !1 === e.isConnected) return;
                            let l = U(n(e), r);
                            if (o || (l.x = 0), u || (l.y = 0), i.current = !0, Math.abs(l.x) > 0 || Math.abs(l.y) > 0) {
                                let t = V(e);
                                t && t.scrollBy({
                                    top: l.y,
                                    left: l.x
                                })
                            }
                        }, [t, o, u, r, n])
                    }({
                        activeNode: null != P ? A.get(P) : null,
                        config: ev.layoutShiftCompensation,
                        initialRect: em,
                        measure: ec.draggable.measure
                    });
                    let eg = eM(eh, ec.draggable.measure, em),
                        ey = eM(eh ? eh.parentElement : null),
                        eb = (0, C.useRef)({
                            activatorEvent: null,
                            active: null,
                            activeNode: eh,
                            collisionRect: null,
                            collisions: null,
                            droppableRects: es,
                            draggableNodes: A,
                            draggingNode: null,
                            draggingNodeRect: null,
                            droppableContainers: Z,
                            over: null,
                            scrollableAncestors: [],
                            scrollAdjustedTranslate: null
                        }),
                        ew = Z.getNodeFor(null == (t = eb.current.over) ? void 0 : t.id),
                        eD = function(e) {
                            let {
                                measure: t
                            } = e, [n, r] = (0, C.useState)(null), l = ek({
                                callback: (0, C.useCallback)(e => {
                                    for (let {
                                            target: n
                                        } of e)
                                        if ((0, D.Re)(n)) {
                                            r(e => {
                                                let r = t(n);
                                                return e ? { ...e,
                                                    width: r.width,
                                                    height: r.height
                                                } : r
                                            });
                                            break
                                        }
                                }, [t])
                            }), i = (0, C.useCallback)(e => {
                                let n = function(e) {
                                    if (!e) return null;
                                    if (e.children.length > 1) return e;
                                    let t = e.children[0];
                                    return (0, D.Re)(t) ? t : e
                                }(e);
                                null == l || l.disconnect(), n && (null == l || l.observe(n)), r(n ? t(n) : null)
                            }, [t, l]), [o, u] = (0, D.wm)(i);
                            return (0, C.useMemo)(() => ({
                                nodeRef: o,
                                rect: n,
                                setRef: u
                            }), [n, o, u])
                        }({
                            measure: ec.dragOverlay.measure
                        }),
                        eP = null != (n = eD.nodeRef.current) ? n : eh,
                        eA = N ? null != (r = eD.rect) ? r : eg : null,
                        eF = !!(eD.nodeRef.current && eD.rect),
                        eq = function(e) {
                            let t = eC(e);
                            return U(e, t)
                        }(eF ? null : eg),
                        eH = eL(eP ? (0, D.Jj)(eP) : null),
                        eK = function(e) {
                            let t = (0, C.useRef)(e),
                                n = (0, D.Gj)(n => e ? n && n !== eR && e && t.current && e.parentNode === t.current.parentNode ? n : X(e) : eR, [e]);
                            return (0, C.useEffect)(() => {
                                t.current = e
                            }, [e]), n
                        }(N ? null != ew ? ew : eh : null),
                        eW = function(e, t) {
                            void 0 === t && (t = K);
                            let [n] = e, r = eL(n ? (0, D.Jj)(n) : null), [l, i] = (0, C.useState)(eI);

                            function o() {
                                i(() => e.length ? e.map(e => Q(e) ? r : new el(t(e), e)) : eI)
                            }
                            let u = ek({
                                callback: o
                            });
                            return (0, D.LI)(() => {
                                null == u || u.disconnect(), o(), e.forEach(e => null == u ? void 0 : u.observe(e))
                            }, [e]), l
                        }(eK),
                        eX = function(e, t) {
                            let {
                                transform: n,
                                ...r
                            } = t;
                            return null != e && e.length ? e.reduce((e, t) => t({
                                transform: e,
                                ...r
                            }), n) : n
                        }(m, {
                            transform: {
                                x: j.x - eq.x,
                                y: j.y - eq.y,
                                scaleX: 1,
                                scaleY: 1
                            },
                            activatorEvent: er,
                            active: H,
                            activeNodeRect: eg,
                            containerNodeRect: ey,
                            draggingNodeRect: eA,
                            over: eb.current.over,
                            overlayNodeRect: eD.rect,
                            scrollableAncestors: eK,
                            scrollableAncestorRects: eW,
                            windowRect: eH
                        }),
                        eV = ep ? (0, D.IH)(ep, j) : null,
                        e$ = function(e) {
                            let [t, n] = (0, C.useState)(null), r = (0, C.useRef)(e), l = (0, C.useCallback)(e => {
                                let t = $(e.target);
                                t && n(e => e ? (e.set(t, G(t)), new Map(e)) : null)
                            }, []);
                            return (0, C.useEffect)(() => {
                                let t = r.current;
                                if (e !== t) {
                                    i(t);
                                    let o = e.map(e => {
                                        let t = $(e);
                                        return t ? (t.addEventListener("scroll", l, {
                                            passive: !0
                                        }), [t, G(t)]) : null
                                    }).filter(e => null != e);
                                    n(o.length ? new Map(o) : null), r.current = e
                                }
                                return () => {
                                    i(e), i(t)
                                };

                                function i(e) {
                                    e.forEach(e => {
                                        let t = $(e);
                                        null == t || t.removeEventListener("scroll", l)
                                    })
                                }
                            }, [l, e]), (0, C.useMemo)(() => e.length ? t ? Array.from(t.values()).reduce((e, t) => (0, D.IH)(e, t), F) : en(e) : F, [e, t])
                        }(eK),
                        eY = eS(e$),
                        eJ = eS(e$, [eg]),
                        eG = (0, D.IH)(eX, eY),
                        eQ = eA ? q(eA, eX) : null,
                        e0 = H && eQ ? f({
                            active: H,
                            collisionRect: eQ,
                            droppableRects: es,
                            droppableContainers: ea,
                            pointerCoordinates: eV
                        }) : null,
                        e1 = function(e, t) {
                            if (!e || 0 === e.length) return null;
                            let [n] = e;
                            return n.id
                        }(e0, 0),
                        [e2, e8] = (0, C.useState)(null),
                        e5 = (i = eF ? eX : (0, D.IH)(eX, eJ), o = null != (l = null == e2 ? void 0 : e2.rect) ? l : null, { ...i,
                            scaleX: o && eg ? o.width / eg.width : 1,
                            scaleY: o && eg ? o.height / eg.height : 1
                        }),
                        e3 = (0, C.useRef)(null),
                        e9 = (0, C.useCallback)((e, t) => {
                            let {
                                sensor: n,
                                options: r
                            } = t;
                            if (null == W.current) return;
                            let l = A.get(W.current);
                            if (!l) return;
                            let i = e.nativeEvent,
                                o = new n({
                                    active: W.current,
                                    activeNode: l,
                                    event: i,
                                    options: r,
                                    context: eb,
                                    onAbort(e) {
                                        if (!A.get(e)) return;
                                        let {
                                            onDragAbort: t
                                        } = eo.current, n = {
                                            id: e
                                        };
                                        null == t || t(n), R({
                                            type: "onDragAbort",
                                            event: n
                                        })
                                    },
                                    onPending(e, t, n, r) {
                                        if (!A.get(e)) return;
                                        let {
                                            onDragPending: l
                                        } = eo.current, i = {
                                            id: e,
                                            constraint: t,
                                            initialCoordinates: n,
                                            offset: r
                                        };
                                        null == l || l(i), R({
                                            type: "onDragPending",
                                            event: i
                                        })
                                    },
                                    onStart(e) {
                                        let t = W.current;
                                        if (null == t) return;
                                        let n = A.get(t);
                                        if (!n) return;
                                        let {
                                            onDragStart: r
                                        } = eo.current, l = {
                                            activatorEvent: i,
                                            active: {
                                                id: t,
                                                data: n.data,
                                                rect: _
                                            }
                                        };
                                        (0, k.unstable_batchedUpdates)(() => {
                                            null == r || r(l), O(x.Initializing), M({
                                                type: h.DragStart,
                                                initialCoordinates: e,
                                                active: t
                                            }), R({
                                                type: "onDragStart",
                                                event: l
                                            }), J(e3.current), ei(i)
                                        })
                                    },
                                    onMove(e) {
                                        M({
                                            type: h.DragMove,
                                            coordinates: e
                                        })
                                    },
                                    onEnd: u(h.DragEnd),
                                    onCancel: u(h.DragCancel)
                                });

                            function u(e) {
                                return async function() {
                                    let {
                                        active: t,
                                        collisions: n,
                                        over: r,
                                        scrollAdjustedTranslate: l
                                    } = eb.current, o = null;
                                    if (t && l) {
                                        let {
                                            cancelDrop: u
                                        } = eo.current;
                                        o = {
                                            activatorEvent: i,
                                            active: t,
                                            collisions: n,
                                            delta: l,
                                            over: r
                                        }, e === h.DragEnd && "function" == typeof u && await Promise.resolve(u(o)) && (e = h.DragCancel)
                                    }
                                    W.current = null, (0, k.unstable_batchedUpdates)(() => {
                                        M({
                                            type: e
                                        }), O(x.Uninitialized), e8(null), J(null), ei(null), e3.current = null;
                                        let t = e === h.DragEnd ? "onDragEnd" : "onDragCancel";
                                        if (o) {
                                            let e = eo.current[t];
                                            null == e || e(o), R({
                                                type: t,
                                                event: o
                                            })
                                        }
                                    })
                                }
                            }
                            e3.current = o
                        }, [A]),
                        e4 = (0, C.useCallback)((e, t) => (n, r) => {
                            let l = n.nativeEvent,
                                i = A.get(r);
                            null !== W.current || !i || l.dndKit || l.defaultPrevented || !0 !== e(n, t.options, {
                                active: i
                            }) || (l.dndKit = {
                                capturedBy: t.sensor
                            }, W.current = r, e9(n, t))
                        }, [A, e9]),
                        e6 = (0, C.useMemo)(() => d.reduce((e, t) => {
                            let {
                                sensor: n
                            } = t;
                            return [...e, ...n.activators.map(e => ({
                                eventName: e.eventName,
                                handler: e4(e.handler, t)
                            }))]
                        }, []), [d, e4]);
                    (0, C.useEffect)(() => {
                        if (!D.Nq) return;
                        let e = d.map(e => {
                            let {
                                sensor: t
                            } = e;
                            return null == t.setup ? void 0 : t.setup()
                        });
                        return () => {
                            for (let t of e) null == t || t()
                        }
                    }, d.map(e => {
                        let {
                            sensor: t
                        } = e;
                        return t
                    })), (0, D.LI)(() => {
                        eg && I === x.Initializing && O(x.Initialized)
                    }, [eg, I]), (0, C.useEffect)(() => {
                        let {
                            onDragMove: e
                        } = eo.current, {
                            active: t,
                            activatorEvent: n,
                            collisions: r,
                            over: l
                        } = eb.current;
                        if (!t || !n) return;
                        let i = {
                            active: t,
                            activatorEvent: n,
                            collisions: r,
                            delta: {
                                x: eG.x,
                                y: eG.y
                            },
                            over: l
                        };
                        (0, k.unstable_batchedUpdates)(() => {
                            null == e || e(i), R({
                                type: "onDragMove",
                                event: i
                            })
                        })
                    }, [eG.x, eG.y]), (0, C.useEffect)(() => {
                        let {
                            active: e,
                            activatorEvent: t,
                            collisions: n,
                            droppableContainers: r,
                            scrollAdjustedTranslate: l
                        } = eb.current;
                        if (!e || null == W.current || !t || !l) return;
                        let {
                            onDragOver: i
                        } = eo.current, o = r.get(e1), u = o && o.rect.current ? {
                            id: o.id,
                            rect: o.rect.current,
                            data: o.data,
                            disabled: o.disabled
                        } : null, a = {
                            active: e,
                            activatorEvent: t,
                            collisions: n,
                            delta: {
                                x: l.x,
                                y: l.y
                            },
                            over: u
                        };
                        (0, k.unstable_batchedUpdates)(() => {
                            e8(u), null == i || i(a), R({
                                type: "onDragOver",
                                event: a
                            })
                        })
                    }, [e1]), (0, D.LI)(() => {
                        eb.current = {
                            activatorEvent: er,
                            active: H,
                            activeNode: eh,
                            collisionRect: eQ,
                            collisions: e0,
                            droppableRects: es,
                            draggableNodes: A,
                            draggingNode: eP,
                            draggingNodeRect: eA,
                            droppableContainers: Z,
                            over: e2,
                            scrollableAncestors: eK,
                            scrollAdjustedTranslate: eG
                        }, _.current = {
                            initial: eA,
                            translated: eQ
                        }
                    }, [H, eh, e0, eQ, A, eP, eA, es, Z, e2, eK, eG]),
                    function(e) {
                        let {
                            acceleration: t,
                            activator: n = y.Pointer,
                            canScroll: r,
                            draggingRect: l,
                            enabled: i,
                            interval: o = 5,
                            order: u = b.TreeOrder,
                            pointerCoordinates: a,
                            scrollableAncestors: c,
                            scrollableAncestorRects: s,
                            delta: d,
                            threshold: f
                        } = e, h = function(e) {
                            let {
                                delta: t,
                                disabled: n
                            } = e, r = (0, D.D9)(t);
                            return (0, D.Gj)(e => {
                                if (n || !r || !e) return eE;
                                let l = {
                                    x: Math.sign(t.x - r.x),
                                    y: Math.sign(t.y - r.y)
                                };
                                return {
                                    x: {
                                        [p.Backward]: e.x[p.Backward] || -1 === l.x,
                                        [p.Forward]: e.x[p.Forward] || 1 === l.x
                                    },
                                    y: {
                                        [p.Backward]: e.y[p.Backward] || -1 === l.y,
                                        [p.Forward]: e.y[p.Forward] || 1 === l.y
                                    }
                                }
                            }, [n, t, r])
                        }({
                            delta: d,
                            disabled: !i
                        }), [v, m] = (0, D.Yz)(), g = (0, C.useRef)({
                            x: 0,
                            y: 0
                        }), w = (0, C.useRef)({
                            x: 0,
                            y: 0
                        }), E = (0, C.useMemo)(() => {
                            switch (n) {
                                case y.Pointer:
                                    return a ? {
                                        top: a.y,
                                        bottom: a.y,
                                        left: a.x,
                                        right: a.x
                                    } : null;
                                case y.DraggableRect:
                                    return l
                            }
                        }, [n, l, a]), x = (0, C.useRef)(null), k = (0, C.useCallback)(() => {
                            let e = x.current;
                            if (!e) return;
                            let t = g.current.x * w.current.x,
                                n = g.current.y * w.current.y;
                            e.scrollBy(t, n)
                        }, []), M = (0, C.useMemo)(() => u === b.TreeOrder ? [...c].reverse() : c, [u, c]);
                        (0, C.useEffect)(() => {
                            if (!i || !c.length || !E) {
                                m();
                                return
                            }
                            for (let e of M) {
                                if ((null == r ? void 0 : r(e)) === !1) continue;
                                let n = s[c.indexOf(e)];
                                if (!n) continue;
                                let {
                                    direction: l,
                                    speed: i
                                } = function(e, t, n, r, l) {
                                    let {
                                        top: i,
                                        left: o,
                                        right: u,
                                        bottom: a
                                    } = n;
                                    void 0 === r && (r = 10), void 0 === l && (l = et);
                                    let {
                                        isTop: c,
                                        isBottom: s,
                                        isLeft: d,
                                        isRight: f
                                    } = ee(e), h = {
                                        x: 0,
                                        y: 0
                                    }, v = {
                                        x: 0,
                                        y: 0
                                    }, m = {
                                        height: t.height * l.y,
                                        width: t.width * l.x
                                    };
                                    return !c && i <= t.top + m.height ? (h.y = p.Backward, v.y = r * Math.abs((t.top + m.height - i) / m.height)) : !s && a >= t.bottom - m.height && (h.y = p.Forward, v.y = r * Math.abs((t.bottom - m.height - a) / m.height)), !f && u >= t.right - m.width ? (h.x = p.Forward, v.x = r * Math.abs((t.right - m.width - u) / m.width)) : !d && o <= t.left + m.width && (h.x = p.Backward, v.x = r * Math.abs((t.left + m.width - o) / m.width)), {
                                        direction: h,
                                        speed: v
                                    }
                                }(e, n, E, t, f);
                                for (let e of ["x", "y"]) h[e][l[e]] || (i[e] = 0, l[e] = 0);
                                if (i.x > 0 || i.y > 0) {
                                    m(), x.current = e, v(k, o), g.current = i, w.current = l;
                                    return
                                }
                            }
                            g.current = {
                                x: 0,
                                y: 0
                            }, w.current = {
                                x: 0,
                                y: 0
                            }, m()
                        }, [t, k, r, m, i, o, JSON.stringify(E), JSON.stringify(h), v, c, M, s, JSON.stringify(f)])
                    }({ ...ev,
                        delta: j,
                        draggingRect: eQ,
                        pointerCoordinates: eV,
                        scrollableAncestors: eK,
                        scrollableAncestorRects: eW
                    });
                    let e7 = (0, C.useMemo)(() => ({
                            active: H,
                            activeNode: eh,
                            activeNodeRect: eg,
                            activatorEvent: er,
                            collisions: e0,
                            containerNodeRect: ey,
                            dragOverlay: eD,
                            draggableNodes: A,
                            droppableContainers: Z,
                            droppableRects: es,
                            over: e2,
                            measureDroppableContainers: ed,
                            scrollableAncestors: eK,
                            scrollableAncestorRects: eW,
                            measuringConfiguration: ec,
                            measuringScheduled: ef,
                            windowRect: eH
                        }), [H, eh, eg, er, e0, ey, eD, A, Z, es, e2, ed, eK, eW, ec, ef, eH]),
                        te = (0, C.useMemo)(() => ({
                            activatorEvent: er,
                            activators: e6,
                            active: H,
                            activeNodeRect: eg,
                            ariaDescribedById: {
                                draggable: eu
                            },
                            dispatch: M,
                            draggableNodes: A,
                            over: e2,
                            measureDroppableContainers: ed
                        }), [er, e6, H, eg, M, eu, A, e2, ed]);
                    return C.createElement(L.Provider, {
                        value: S
                    }, C.createElement(ej.Provider, {
                        value: te
                    }, C.createElement(eZ.Provider, {
                        value: e7
                    }, C.createElement(eU.Provider, {
                        value: e5
                    }, s)), C.createElement(eB, {
                        disabled: (null == a ? void 0 : a.restoreFocus) === !1
                    })), C.createElement(T, { ...a,
                        hiddenTextDescribedById: eu
                    }))
                }),
                eH = (0, C.createContext)(null),
                eK = "button";

            function eW(e) {
                let {
                    id: t,
                    data: n,
                    disabled: r = !1,
                    attributes: l
                } = e, i = (0, D.Ld)("Draggable"), {
                    activators: o,
                    activatorEvent: u,
                    active: a,
                    activeNodeRect: c,
                    ariaDescribedById: s,
                    draggableNodes: d,
                    over: f
                } = (0, C.useContext)(ej), {
                    role: h = eK,
                    roleDescription: p = "draggable",
                    tabIndex: v = 0
                } = null != l ? l : {}, m = (null == a ? void 0 : a.id) === t, g = (0, C.useContext)(m ? eU : eH), [y, b] = (0, D.wm)(), [w, E] = (0, D.wm)(), x = (0, C.useMemo)(() => o.reduce((e, n) => {
                    let {
                        eventName: r,
                        handler: l
                    } = n;
                    return e[r] = e => {
                        l(e, t)
                    }, e
                }, {}), [o, t]), k = (0, D.Ey)(n);
                return (0, D.LI)(() => (d.set(t, {
                    id: t,
                    key: i,
                    node: y,
                    activatorNode: w,
                    data: k
                }), () => {
                    let e = d.get(t);
                    e && e.key === i && d.delete(t)
                }), [d, t]), {
                    active: a,
                    activatorEvent: u,
                    activeNodeRect: c,
                    attributes: (0, C.useMemo)(() => ({
                        role: h,
                        tabIndex: v,
                        "aria-disabled": r,
                        "aria-pressed": !!m && h === eK || void 0,
                        "aria-roledescription": p,
                        "aria-describedby": s.draggable
                    }), [r, h, v, m, p, s.draggable]),
                    isDragging: m,
                    listeners: r ? void 0 : x,
                    node: y,
                    over: f,
                    setNodeRef: b,
                    setActivatorNodeRef: E,
                    transform: g
                }
            }

            function eX() {
                return (0, C.useContext)(eZ)
            }
            let eV = {
                timeout: 25
            };

            function e$(e) {
                let {
                    data: t,
                    disabled: n = !1,
                    id: r,
                    resizeObserverConfig: l
                } = e, i = (0, D.Ld)("Droppable"), {
                    active: o,
                    dispatch: u,
                    over: a,
                    measureDroppableContainers: c
                } = (0, C.useContext)(ej), s = (0, C.useRef)({
                    disabled: n
                }), d = (0, C.useRef)(!1), f = (0, C.useRef)(null), p = (0, C.useRef)(null), {
                    disabled: v,
                    updateMeasurementsFor: m,
                    timeout: g
                } = { ...eV,
                    ...l
                }, y = (0, D.Ey)(null != m ? m : r), b = ek({
                    callback: (0, C.useCallback)(() => {
                        if (!d.current) {
                            d.current = !0;
                            return
                        }
                        null != p.current && clearTimeout(p.current), p.current = setTimeout(() => {
                            c(Array.isArray(y.current) ? y.current : [y.current]), p.current = null
                        }, g)
                    }, [g]),
                    disabled: v || !o
                }), w = (0, C.useCallback)((e, t) => {
                    b && (t && (b.unobserve(t), d.current = !1), e && b.observe(e))
                }, [b]), [E, x] = (0, D.wm)(w), k = (0, D.Ey)(t);
                return (0, C.useEffect)(() => {
                    b && E.current && (b.disconnect(), d.current = !1, b.observe(E.current))
                }, [E, b]), (0, C.useEffect)(() => (u({
                    type: h.RegisterDroppable,
                    element: {
                        id: r,
                        key: i,
                        disabled: n,
                        node: E,
                        rect: f,
                        data: k
                    }
                }), () => u({
                    type: h.UnregisterDroppable,
                    key: i,
                    id: r
                })), [r]), (0, C.useEffect)(() => {
                    n !== s.current.disabled && (u({
                        type: h.SetDroppableDisabled,
                        id: r,
                        key: i,
                        disabled: n
                    }), s.current.disabled = n)
                }, [r, i, n, u]), {
                    active: o,
                    rect: f,
                    isOver: (null == a ? void 0 : a.id) === r,
                    node: E,
                    over: a,
                    setNodeRef: x
                }
            }
            r = {
                styles: {
                    active: {
                        opacity: "0"
                    }
                }
            }, e => {
                let {
                    active: t,
                    dragOverlay: n
                } = e, l = {}, {
                    styles: i,
                    className: o
                } = r;
                if (null != i && i.active)
                    for (let [e, n] of Object.entries(i.active)) void 0 !== n && (l[e] = t.node.style.getPropertyValue(e), t.node.style.setProperty(e, n));
                if (null != i && i.dragOverlay)
                    for (let [e, t] of Object.entries(i.dragOverlay)) void 0 !== t && n.node.style.setProperty(e, t);
                return null != o && o.active && t.node.classList.add(o.active), null != o && o.dragOverlay && n.node.classList.add(o.dragOverlay),
                    function() {
                        for (let [e, n] of Object.entries(l)) t.node.style.setProperty(e, n);
                        null != o && o.active && t.node.classList.remove(o.active)
                    }
            }
        },
        36218: function(e, t, n) {
            n.d(t, {
                Fo: function() {
                    return h
                },
                Rp: function() {
                    return o
                },
                nB: function() {
                    return w
                },
                qw: function() {
                    return s
                }
            });
            var r = n(55185),
                l = n(53120),
                i = n(83357);

            function o(e, t, n) {
                let r = e.slice();
                return r.splice(n < 0 ? r.length + n : n, 0, r.splice(t, 1)[0]), r
            }

            function u(e) {
                return null !== e && e >= 0
            }
            let a = e => {
                    let {
                        rects: t,
                        activeIndex: n,
                        overIndex: r,
                        index: l
                    } = e, i = o(t, r, n), u = t[l], a = i[l];
                    return a && u ? {
                        x: a.left - u.left,
                        y: a.top - u.top,
                        scaleX: a.width / u.width,
                        scaleY: a.height / u.height
                    } : null
                },
                c = {
                    scaleX: 1,
                    scaleY: 1
                },
                s = e => {
                    var t;
                    let {
                        activeIndex: n,
                        activeNodeRect: r,
                        index: l,
                        rects: i,
                        overIndex: o
                    } = e, u = null != (t = i[n]) ? t : r;
                    if (!u) return null;
                    if (l === n) {
                        let e = i[o];
                        return e ? {
                            x: 0,
                            y: n < o ? e.top + e.height - (u.top + u.height) : e.top - u.top,
                            ...c
                        } : null
                    }
                    let a = function(e, t, n) {
                        let r = e[t],
                            l = e[t - 1],
                            i = e[t + 1];
                        return r ? n < t ? l ? r.top - (l.top + l.height) : i ? i.top - (r.top + r.height) : 0 : i ? i.top - (r.top + r.height) : l ? r.top - (l.top + l.height) : 0 : 0
                    }(i, l, n);
                    return l > n && l <= o ? {
                        x: 0,
                        y: -u.height - a,
                        ...c
                    } : l < n && l >= o ? {
                        x: 0,
                        y: u.height + a,
                        ...c
                    } : {
                        x: 0,
                        y: 0,
                        ...c
                    }
                },
                d = "Sortable",
                f = r.createContext({
                    activeIndex: -1,
                    containerId: d,
                    disableTransforms: !1,
                    items: [],
                    overIndex: -1,
                    useDragOverlay: !1,
                    sortedRects: [],
                    strategy: a,
                    disabled: {
                        draggable: !1,
                        droppable: !1
                    }
                });

            function h(e) {
                let {
                    children: t,
                    id: n,
                    items: o,
                    strategy: u = a,
                    disabled: c = !1
                } = e, {
                    active: s,
                    dragOverlay: h,
                    droppableRects: p,
                    over: v,
                    measureDroppableContainers: m
                } = (0, l.Cj)(), g = (0, i.Ld)(d, n), y = null !== h.rect, b = (0, r.useMemo)(() => o.map(e => "object" == typeof e && "id" in e ? e.id : e), [o]), w = null != s, E = s ? b.indexOf(s.id) : -1, x = v ? b.indexOf(v.id) : -1, C = (0, r.useRef)(b), k = ! function(e, t) {
                    if (e === t) return !0;
                    if (e.length !== t.length) return !1;
                    for (let n = 0; n < e.length; n++)
                        if (e[n] !== t[n]) return !1;
                    return !0
                }(b, C.current), D = -1 !== x && -1 === E || k, M = "boolean" == typeof c ? {
                    draggable: c,
                    droppable: c
                } : c;
                (0, i.LI)(() => {
                    k && w && m(b)
                }, [k, b, w, m]), (0, r.useEffect)(() => {
                    C.current = b
                }, [b]);
                let R = (0, r.useMemo)(() => ({
                    activeIndex: E,
                    containerId: g,
                    disabled: M,
                    disableTransforms: D,
                    items: b,
                    overIndex: x,
                    useDragOverlay: y,
                    sortedRects: b.reduce((e, t, n) => {
                        let r = p.get(t);
                        return r && (e[n] = r), e
                    }, Array(b.length)),
                    strategy: u
                }), [E, g, M.draggable, M.droppable, D, b, x, p, y, u]);
                return r.createElement(f.Provider, {
                    value: R
                }, t)
            }
            let p = e => {
                    let {
                        id: t,
                        items: n,
                        activeIndex: r,
                        overIndex: l
                    } = e;
                    return o(n, r, l).indexOf(t)
                },
                v = e => {
                    let {
                        containerId: t,
                        isSorting: n,
                        wasDragging: r,
                        index: l,
                        items: i,
                        newIndex: o,
                        previousItems: u,
                        previousContainerId: a,
                        transition: c
                    } = e;
                    return !!c && !!r && (u === i || l !== o) && (!!n || o !== l && t === a)
                },
                m = {
                    duration: 200,
                    easing: "ease"
                },
                g = "transform",
                y = i.ux.Transition.toString({
                    property: g,
                    duration: 0,
                    easing: "linear"
                }),
                b = {
                    roleDescription: "sortable"
                };

            function w(e) {
                var t, n;
                let {
                    animateLayoutChanges: o = v,
                    attributes: a,
                    disabled: c,
                    data: s,
                    getNewIndex: d = p,
                    id: h,
                    strategy: w,
                    resizeObserverConfig: E,
                    transition: x = m
                } = e, {
                    items: C,
                    containerId: k,
                    activeIndex: D,
                    disabled: M,
                    disableTransforms: R,
                    sortedRects: S,
                    overIndex: L,
                    useDragOverlay: I,
                    strategy: O
                } = (0, r.useContext)(f), T = "boolean" == typeof c ? {
                    draggable: c,
                    droppable: !1
                } : {
                    draggable: null != (t = null == c ? void 0 : c.draggable) ? t : M.draggable,
                    droppable: null != (n = null == c ? void 0 : c.droppable) ? n : M.droppable
                }, N = C.indexOf(h), P = (0, r.useMemo)(() => ({
                    sortable: {
                        containerId: k,
                        index: N,
                        items: C
                    },
                    ...s
                }), [k, s, N, C]), A = (0, r.useMemo)(() => C.slice(C.indexOf(h)), [C, h]), {
                    rect: F,
                    node: j,
                    isOver: Z,
                    setNodeRef: z
                } = (0, l.Zj)({
                    id: h,
                    data: P,
                    disabled: T.droppable,
                    resizeObserverConfig: {
                        updateMeasurementsFor: A,
                        ...E
                    }
                }), {
                    active: _,
                    activatorEvent: B,
                    activeNodeRect: U,
                    attributes: q,
                    setNodeRef: H,
                    listeners: K,
                    isDragging: W,
                    over: X,
                    setActivatorNodeRef: V,
                    transform: $
                } = (0, l.O1)({
                    id: h,
                    data: P,
                    attributes: { ...b,
                        ...a
                    },
                    disabled: T.draggable
                }), Y = (0, i.HB)(z, H), J = !!_, G = J && !R && u(D) && u(L), Q = !I && W, ee = Q && G ? $ : null, et = G ? null != ee ? ee : (null != w ? w : O)({
                    rects: S,
                    activeNodeRect: U,
                    activeIndex: D,
                    overIndex: L,
                    index: N
                }) : null, en = u(D) && u(L) ? d({
                    id: h,
                    items: C,
                    activeIndex: D,
                    overIndex: L
                }) : N, er = null == _ ? void 0 : _.id, el = (0, r.useRef)({
                    activeId: er,
                    items: C,
                    newIndex: en,
                    containerId: k
                }), ei = C !== el.current.items, eo = o({
                    active: _,
                    containerId: k,
                    isDragging: W,
                    isSorting: J,
                    id: h,
                    index: N,
                    items: C,
                    newIndex: el.current.newIndex,
                    previousItems: el.current.items,
                    previousContainerId: el.current.containerId,
                    transition: x,
                    wasDragging: null != el.current.activeId
                }), eu = function(e) {
                    let {
                        disabled: t,
                        index: n,
                        node: o,
                        rect: u
                    } = e, [a, c] = (0, r.useState)(null), s = (0, r.useRef)(n);
                    return (0, i.LI)(() => {
                        if (!t && n !== s.current && o.current) {
                            let e = u.current;
                            if (e) {
                                let t = (0, l.VK)(o.current, {
                                        ignoreTransform: !0
                                    }),
                                    n = {
                                        x: e.left - t.left,
                                        y: e.top - t.top,
                                        scaleX: e.width / t.width,
                                        scaleY: e.height / t.height
                                    };
                                (n.x || n.y) && c(n)
                            }
                        }
                        n !== s.current && (s.current = n)
                    }, [t, n, o, u]), (0, r.useEffect)(() => {
                        a && c(null)
                    }, [a]), a
                }({
                    disabled: !eo,
                    index: N,
                    node: j,
                    rect: F
                });
                return (0, r.useEffect)(() => {
                    J && el.current.newIndex !== en && (el.current.newIndex = en), k !== el.current.containerId && (el.current.containerId = k), C !== el.current.items && (el.current.items = C)
                }, [J, en, k, C]), (0, r.useEffect)(() => {
                    if (er === el.current.activeId) return;
                    if (null != er && null == el.current.activeId) {
                        el.current.activeId = er;
                        return
                    }
                    let e = setTimeout(() => {
                        el.current.activeId = er
                    }, 50);
                    return () => clearTimeout(e)
                }, [er]), {
                    active: _,
                    activeIndex: D,
                    attributes: q,
                    data: P,
                    rect: F,
                    index: N,
                    newIndex: en,
                    items: C,
                    isOver: Z,
                    isSorting: J,
                    isDragging: W,
                    listeners: K,
                    node: j,
                    overIndex: L,
                    over: X,
                    setNodeRef: Y,
                    setActivatorNodeRef: V,
                    setDroppableNodeRef: z,
                    setDraggableNodeRef: H,
                    transform: null != eu ? eu : et,
                    transition: eu || ei && el.current.newIndex === N ? y : (!Q || (0, i.vd)(B)) && x && (J || eo) ? i.ux.Transition.toString({ ...x,
                        property: g
                    }) : void 0
                }
            }
            l.g4.Down, l.g4.Right, l.g4.Up, l.g4.Left
        },
        83357: function(e, t, n) {
            n.d(t, {
                $X: function() {
                    return k
                },
                D9: function() {
                    return b
                },
                DC: function() {
                    return M
                },
                Ey: function() {
                    return m
                },
                FJ: function() {
                    return o
                },
                Gj: function() {
                    return g
                },
                HB: function() {
                    return l
                },
                IH: function() {
                    return C
                },
                Jj: function() {
                    return a
                },
                LI: function() {
                    return h
                },
                Ld: function() {
                    return E
                },
                Nq: function() {
                    return i
                },
                Re: function() {
                    return s
                },
                UG: function() {
                    return u
                },
                Yz: function() {
                    return v
                },
                qk: function() {
                    return c
                },
                r3: function() {
                    return f
                },
                so: function() {
                    return L
                },
                ux: function() {
                    return R
                },
                vZ: function() {
                    return d
                },
                vd: function() {
                    return D
                },
                wm: function() {
                    return y
                },
                zX: function() {
                    return p
                }
            });
            var r = n(55185);

            function l() {
                for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n];
                return (0, r.useMemo)(() => e => {
                    t.forEach(t => t(e))
                }, t)
            }
            let i = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;

            function o(e) {
                let t = Object.prototype.toString.call(e);
                return "[object Window]" === t || "[object global]" === t
            }

            function u(e) {
                return "nodeType" in e
            }

            function a(e) {
                var t, n;
                return e ? o(e) ? e : u(e) && null != (t = null == (n = e.ownerDocument) ? void 0 : n.defaultView) ? t : window : window
            }

            function c(e) {
                let {
                    Document: t
                } = a(e);
                return e instanceof t
            }

            function s(e) {
                return !o(e) && e instanceof a(e).HTMLElement
            }

            function d(e) {
                return e instanceof a(e).SVGElement
            }

            function f(e) {
                return e ? o(e) ? e.document : u(e) ? c(e) ? e : s(e) || d(e) ? e.ownerDocument : document : document : document
            }
            let h = i ? r.useLayoutEffect : r.useEffect;

            function p(e) {
                let t = (0, r.useRef)(e);
                return h(() => {
                    t.current = e
                }), (0, r.useCallback)(function() {
                    for (var e = arguments.length, n = Array(e), r = 0; r < e; r++) n[r] = arguments[r];
                    return null == t.current ? void 0 : t.current(...n)
                }, [])
            }

            function v() {
                let e = (0, r.useRef)(null);
                return [(0, r.useCallback)((t, n) => {
                    e.current = setInterval(t, n)
                }, []), (0, r.useCallback)(() => {
                    null !== e.current && (clearInterval(e.current), e.current = null)
                }, [])]
            }

            function m(e, t) {
                void 0 === t && (t = [e]);
                let n = (0, r.useRef)(e);
                return h(() => {
                    n.current !== e && (n.current = e)
                }, t), n
            }

            function g(e, t) {
                let n = (0, r.useRef)();
                return (0, r.useMemo)(() => {
                    let t = e(n.current);
                    return n.current = t, t
                }, [...t])
            }

            function y(e) {
                let t = p(e),
                    n = (0, r.useRef)(null),
                    l = (0, r.useCallback)(e => {
                        e !== n.current && (null == t || t(e, n.current)), n.current = e
                    }, []);
                return [n, l]
            }

            function b(e) {
                let t = (0, r.useRef)();
                return (0, r.useEffect)(() => {
                    t.current = e
                }, [e]), t.current
            }
            let w = {};

            function E(e, t) {
                return (0, r.useMemo)(() => {
                    if (t) return t;
                    let n = null == w[e] ? 0 : w[e] + 1;
                    return w[e] = n, e + "-" + n
                }, [e, t])
            }

            function x(e) {
                return function(t) {
                    for (var n = arguments.length, r = Array(n > 1 ? n - 1 : 0), l = 1; l < n; l++) r[l - 1] = arguments[l];
                    return r.reduce((t, n) => {
                        for (let [r, l] of Object.entries(n)) {
                            let n = t[r];
                            null != n && (t[r] = n + e * l)
                        }
                        return t
                    }, { ...t
                    })
                }
            }
            let C = x(1),
                k = x(-1);

            function D(e) {
                if (!e) return !1;
                let {
                    KeyboardEvent: t
                } = a(e.target);
                return t && e instanceof t
            }

            function M(e) {
                if (function(e) {
                        if (!e) return !1;
                        let {
                            TouchEvent: t
                        } = a(e.target);
                        return t && e instanceof t
                    }(e)) {
                    if (e.touches && e.touches.length) {
                        let {
                            clientX: t,
                            clientY: n
                        } = e.touches[0];
                        return {
                            x: t,
                            y: n
                        }
                    }
                    if (e.changedTouches && e.changedTouches.length) {
                        let {
                            clientX: t,
                            clientY: n
                        } = e.changedTouches[0];
                        return {
                            x: t,
                            y: n
                        }
                    }
                }
                return "clientX" in e && "clientY" in e ? {
                    x: e.clientX,
                    y: e.clientY
                } : null
            }
            let R = Object.freeze({
                    Translate: {
                        toString(e) {
                            if (!e) return;
                            let {
                                x: t,
                                y: n
                            } = e;
                            return "translate3d(" + (t ? Math.round(t) : 0) + "px, " + (n ? Math.round(n) : 0) + "px, 0)"
                        }
                    },
                    Scale: {
                        toString(e) {
                            if (!e) return;
                            let {
                                scaleX: t,
                                scaleY: n
                            } = e;
                            return "scaleX(" + t + ") scaleY(" + n + ")"
                        }
                    },
                    Transform: {
                        toString(e) {
                            if (e) return [R.Translate.toString(e), R.Scale.toString(e)].join(" ")
                        }
                    },
                    Transition: {
                        toString(e) {
                            let {
                                property: t,
                                duration: n,
                                easing: r
                            } = e;
                            return t + " " + n + "ms " + r
                        }
                    }
                }),
                S = "a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),*[tabindex]";

            function L(e) {
                return e.matches(S) ? e : e.querySelector(S)
            }
        },
        3300: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Bell", [
                ["path", {
                    d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
                    key: "1qo2s2"
                }],
                ["path", {
                    d: "M10.3 21a1.94 1.94 0 0 0 3.4 0",
                    key: "qgo35s"
                }]
            ])
        },
        54032: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Bug", [
                ["path", {
                    d: "m8 2 1.88 1.88",
                    key: "fmnt4t"
                }],
                ["path", {
                    d: "M14.12 3.88 16 2",
                    key: "qol33r"
                }],
                ["path", {
                    d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1",
                    key: "d7y7pr"
                }],
                ["path", {
                    d: "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6",
                    key: "xs1cw7"
                }],
                ["path", {
                    d: "M12 20v-9",
                    key: "1qisl0"
                }],
                ["path", {
                    d: "M6.53 9C4.6 8.8 3 7.1 3 5",
                    key: "32zzws"
                }],
                ["path", {
                    d: "M6 13H2",
                    key: "82j7cp"
                }],
                ["path", {
                    d: "M3 21c0-2.1 1.7-3.9 3.8-4",
                    key: "4p0ekp"
                }],
                ["path", {
                    d: "M20.97 5c0 2.1-1.6 3.8-3.5 4",
                    key: "18gb23"
                }],
                ["path", {
                    d: "M22 13h-4",
                    key: "1jl80f"
                }],
                ["path", {
                    d: "M17.2 17c2.1.1 3.8 1.9 3.8 4",
                    key: "k3fwyw"
                }]
            ])
        },
        43806: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("ChartColumn", [
                ["path", {
                    d: "M3 3v16a2 2 0 0 0 2 2h16",
                    key: "c24i48"
                }],
                ["path", {
                    d: "M18 17V9",
                    key: "2bz60n"
                }],
                ["path", {
                    d: "M13 17V5",
                    key: "1frdt8"
                }],
                ["path", {
                    d: "M8 17v-3",
                    key: "17ska0"
                }]
            ])
        },
        91357: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("CircleAlert", [
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "10",
                    key: "1mglay"
                }],
                ["line", {
                    x1: "12",
                    x2: "12",
                    y1: "8",
                    y2: "12",
                    key: "1pkeuh"
                }],
                ["line", {
                    x1: "12",
                    x2: "12.01",
                    y1: "16",
                    y2: "16",
                    key: "4dfq90"
                }]
            ])
        },
        29453: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("CircleDollarSign", [
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "10",
                    key: "1mglay"
                }],
                ["path", {
                    d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8",
                    key: "1h4pet"
                }],
                ["path", {
                    d: "M12 18V6",
                    key: "zqpxq5"
                }]
            ])
        },
        38330: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("CircleX", [
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "10",
                    key: "1mglay"
                }],
                ["path", {
                    d: "m15 9-6 6",
                    key: "1uzhvr"
                }],
                ["path", {
                    d: "m9 9 6 6",
                    key: "z0biqf"
                }]
            ])
        },
        62370: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Ellipsis", [
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "1",
                    key: "41hilf"
                }],
                ["circle", {
                    cx: "19",
                    cy: "12",
                    r: "1",
                    key: "1wjl8i"
                }],
                ["circle", {
                    cx: "5",
                    cy: "12",
                    r: "1",
                    key: "1pcz8c"
                }]
            ])
        },
        5590: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Grip", [
                ["circle", {
                    cx: "12",
                    cy: "5",
                    r: "1",
                    key: "gxeob9"
                }],
                ["circle", {
                    cx: "19",
                    cy: "5",
                    r: "1",
                    key: "w8mnmm"
                }],
                ["circle", {
                    cx: "5",
                    cy: "5",
                    r: "1",
                    key: "lttvr7"
                }],
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "1",
                    key: "41hilf"
                }],
                ["circle", {
                    cx: "19",
                    cy: "12",
                    r: "1",
                    key: "1wjl8i"
                }],
                ["circle", {
                    cx: "5",
                    cy: "12",
                    r: "1",
                    key: "1pcz8c"
                }],
                ["circle", {
                    cx: "12",
                    cy: "19",
                    r: "1",
                    key: "lyex9k"
                }],
                ["circle", {
                    cx: "19",
                    cy: "19",
                    r: "1",
                    key: "shf9b7"
                }],
                ["circle", {
                    cx: "5",
                    cy: "19",
                    r: "1",
                    key: "bfqh0e"
                }]
            ])
        },
        37824: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Heart", [
                ["path", {
                    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
                    key: "c3ymky"
                }]
            ])
        },
        77463: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Info", [
                ["circle", {
                    cx: "12",
                    cy: "12",
                    r: "10",
                    key: "1mglay"
                }],
                ["path", {
                    d: "M12 16v-4",
                    key: "1dtifu"
                }],
                ["path", {
                    d: "M12 8h.01",
                    key: "e9boi3"
                }]
            ])
        },
        52901: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Pointer", [
                ["path", {
                    d: "M22 14a8 8 0 0 1-8 8",
                    key: "56vcr3"
                }],
                ["path", {
                    d: "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2",
                    key: "1agjmk"
                }],
                ["path", {
                    d: "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1",
                    key: "wdbh2u"
                }],
                ["path", {
                    d: "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10",
                    key: "1ibuk9"
                }],
                ["path", {
                    d: "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
                    key: "g6ys72"
                }]
            ])
        },
        45996: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Search", [
                ["circle", {
                    cx: "11",
                    cy: "11",
                    r: "8",
                    key: "4ej97u"
                }],
                ["path", {
                    d: "m21 21-4.3-4.3",
                    key: "1qie3q"
                }]
            ])
        },
        57558: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });
            let r = (0, n(76188).Z)("Trophy", [
                ["path", {
                    d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
                    key: "17hqa7"
                }],
                ["path", {
                    d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
                    key: "lmptdp"
                }],
                ["path", {
                    d: "M4 22h16",
                    key: "57wxv0"
                }],
                ["path", {
                    d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
                    key: "1nw9bq"
                }],
                ["path", {
                    d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
                    key: "1np0yb"
                }],
                ["path", {
                    d: "M18 2H6v7a6 6 0 0 0 12 0V2Z",
                    key: "u46fv3"
                }]
            ])
        },
        63989: function(e, t, n) {
            n.d(t, {
                Z: function() {
                    return r
                }
            });

            function r() {
                return (r = Object.assign ? Object.assign.bind() : function(e) {
                    for (var t = 1; t < arguments.length; t++) {
                        var n = arguments[t];
                        for (var r in n)({}).hasOwnProperty.call(n, r) && (e[r] = n[r])
                    }
                    return e
                }).apply(null, arguments)
            }
        },
        58710: function(e, t, n) {
            let r, l;
            n.d(t, {
                mY: function() {
                    return e8
                }
            });
            var i = /[\\\/_+.#"@\[\(\{&]/,
                o = /[\\\/_+.#"@\[\(\{&]/g,
                u = /[\s-]/,
                a = /[\s-]/g;

            function c(e) {
                return e.toLowerCase().replace(a, " ")
            }
            var s = n(63989),
                d = n(55185),
                f = n.t(d, 2);

            function h(e, t, {
                checkForDefaultPrevented: n = !0
            } = {}) {
                return function(r) {
                    if (null == e || e(r), !1 === n || !r.defaultPrevented) return null == t ? void 0 : t(r)
                }
            }

            function p(...e) {
                return t => e.forEach(e => {
                    "function" == typeof e ? e(t) : null != e && (e.current = t)
                })
            }

            function v(...e) {
                return (0, d.useCallback)(p(...e), e)
            }
            let m = (null == globalThis ? void 0 : globalThis.document) ? d.useLayoutEffect : () => {},
                g = f["useId".toString()] || (() => void 0),
                y = 0;

            function b(e) {
                let [t, n] = d.useState(g());
                return m(() => {
                    e || n(e => null != e ? e : String(y++))
                }, [e]), e || (t ? `radix-${t}` : "")
            }

            function w(e) {
                let t = (0, d.useRef)(e);
                return (0, d.useEffect)(() => {
                    t.current = e
                }), (0, d.useMemo)(() => (...e) => {
                    var n;
                    return null === (n = t.current) || void 0 === n ? void 0 : n.call(t, ...e)
                }, [])
            }
            var E = n(19892);
            let x = (0, d.forwardRef)((e, t) => {
                let {
                    children: n,
                    ...r
                } = e, l = d.Children.toArray(n), i = l.find(D);
                if (i) {
                    let e = i.props.children,
                        n = l.map(t => t !== i ? t : d.Children.count(e) > 1 ? d.Children.only(null) : (0, d.isValidElement)(e) ? e.props.children : null);
                    return (0, d.createElement)(C, (0, s.Z)({}, r, {
                        ref: t
                    }), (0, d.isValidElement)(e) ? (0, d.cloneElement)(e, void 0, n) : null)
                }
                return (0, d.createElement)(C, (0, s.Z)({}, r, {
                    ref: t
                }), n)
            });
            x.displayName = "Slot";
            let C = (0, d.forwardRef)((e, t) => {
                let {
                    children: n,
                    ...r
                } = e;
                return (0, d.isValidElement)(n) ? (0, d.cloneElement)(n, { ... function(e, t) {
                        let n = { ...t
                        };
                        for (let r in t) {
                            let l = e[r],
                                i = t[r];
                            /^on[A-Z]/.test(r) ? l && i ? n[r] = (...e) => {
                                i(...e), l(...e)
                            } : l && (n[r] = l) : "style" === r ? n[r] = { ...l,
                                ...i
                            } : "className" === r && (n[r] = [l, i].filter(Boolean).join(" "))
                        }
                        return { ...e,
                            ...n
                        }
                    }(r, n.props),
                    ref: t ? p(t, n.ref) : n.ref
                }) : d.Children.count(n) > 1 ? d.Children.only(null) : null
            });
            C.displayName = "SlotClone";
            let k = ({
                children: e
            }) => (0, d.createElement)(d.Fragment, null, e);

            function D(e) {
                return (0, d.isValidElement)(e) && e.type === k
            }
            let M = ["a", "button", "div", "form", "h2", "h3", "img", "input", "label", "li", "nav", "ol", "p", "span", "svg", "ul"].reduce((e, t) => {
                    let n = (0, d.forwardRef)((e, n) => {
                        let {
                            asChild: r,
                            ...l
                        } = e, i = r ? x : t;
                        return (0, d.useEffect)(() => {
                            window[Symbol.for("radix-ui")] = !0
                        }, []), (0, d.createElement)(i, (0, s.Z)({}, l, {
                            ref: n
                        }))
                    });
                    return n.displayName = `Primitive.${t}`, { ...e,
                        [t]: n
                    }
                }, {}),
                R = "dismissableLayer.update",
                S = (0, d.createContext)({
                    layers: new Set,
                    layersWithOutsidePointerEventsDisabled: new Set,
                    branches: new Set
                }),
                L = (0, d.forwardRef)((e, t) => {
                    var n;
                    let {
                        disableOutsidePointerEvents: l = !1,
                        onEscapeKeyDown: i,
                        onPointerDownOutside: o,
                        onFocusOutside: u,
                        onInteractOutside: a,
                        onDismiss: c,
                        ...f
                    } = e, p = (0, d.useContext)(S), [m, g] = (0, d.useState)(null), y = null !== (n = null == m ? void 0 : m.ownerDocument) && void 0 !== n ? n : null == globalThis ? void 0 : globalThis.document, [, b] = (0, d.useState)({}), E = v(t, e => g(e)), x = Array.from(p.layers), [C] = [...p.layersWithOutsidePointerEventsDisabled].slice(-1), k = x.indexOf(C), D = m ? x.indexOf(m) : -1, L = p.layersWithOutsidePointerEventsDisabled.size > 0, T = D >= k, N = function(e, t = null == globalThis ? void 0 : globalThis.document) {
                        let n = w(e),
                            r = (0, d.useRef)(!1),
                            l = (0, d.useRef)(() => {});
                        return (0, d.useEffect)(() => {
                            let e = e => {
                                    if (e.target && !r.current) {
                                        let r = {
                                            originalEvent: e
                                        };

                                        function i() {
                                            O("dismissableLayer.pointerDownOutside", n, r, {
                                                discrete: !0
                                            })
                                        }
                                        "touch" === e.pointerType ? (t.removeEventListener("click", l.current), l.current = i, t.addEventListener("click", l.current, {
                                            once: !0
                                        })) : i()
                                    } else t.removeEventListener("click", l.current);
                                    r.current = !1
                                },
                                i = window.setTimeout(() => {
                                    t.addEventListener("pointerdown", e)
                                }, 0);
                            return () => {
                                window.clearTimeout(i), t.removeEventListener("pointerdown", e), t.removeEventListener("click", l.current)
                            }
                        }, [t, n]), {
                            onPointerDownCapture: () => r.current = !0
                        }
                    }(e => {
                        let t = e.target,
                            n = [...p.branches].some(e => e.contains(t));
                        !T || n || (null == o || o(e), null == a || a(e), e.defaultPrevented || null == c || c())
                    }, y), P = function(e, t = null == globalThis ? void 0 : globalThis.document) {
                        let n = w(e),
                            r = (0, d.useRef)(!1);
                        return (0, d.useEffect)(() => {
                            let e = e => {
                                e.target && !r.current && O("dismissableLayer.focusOutside", n, {
                                    originalEvent: e
                                }, {
                                    discrete: !1
                                })
                            };
                            return t.addEventListener("focusin", e), () => t.removeEventListener("focusin", e)
                        }, [t, n]), {
                            onFocusCapture: () => r.current = !0,
                            onBlurCapture: () => r.current = !1
                        }
                    }(e => {
                        let t = e.target;
                        [...p.branches].some(e => e.contains(t)) || (null == u || u(e), null == a || a(e), e.defaultPrevented || null == c || c())
                    }, y);
                    return ! function(e, t = null == globalThis ? void 0 : globalThis.document) {
                        let n = w(e);
                        (0, d.useEffect)(() => {
                            let e = e => {
                                "Escape" === e.key && n(e)
                            };
                            return t.addEventListener("keydown", e), () => t.removeEventListener("keydown", e)
                        }, [n, t])
                    }(e => {
                        D !== p.layers.size - 1 || (null == i || i(e), !e.defaultPrevented && c && (e.preventDefault(), c()))
                    }, y), (0, d.useEffect)(() => {
                        if (m) return l && (0 === p.layersWithOutsidePointerEventsDisabled.size && (r = y.body.style.pointerEvents, y.body.style.pointerEvents = "none"), p.layersWithOutsidePointerEventsDisabled.add(m)), p.layers.add(m), I(), () => {
                            l && 1 === p.layersWithOutsidePointerEventsDisabled.size && (y.body.style.pointerEvents = r)
                        }
                    }, [m, y, l, p]), (0, d.useEffect)(() => () => {
                        m && (p.layers.delete(m), p.layersWithOutsidePointerEventsDisabled.delete(m), I())
                    }, [m, p]), (0, d.useEffect)(() => {
                        let e = () => b({});
                        return document.addEventListener(R, e), () => document.removeEventListener(R, e)
                    }, []), (0, d.createElement)(M.div, (0, s.Z)({}, f, {
                        ref: E,
                        style: {
                            pointerEvents: L ? T ? "auto" : "none" : void 0,
                            ...e.style
                        },
                        onFocusCapture: h(e.onFocusCapture, P.onFocusCapture),
                        onBlurCapture: h(e.onBlurCapture, P.onBlurCapture),
                        onPointerDownCapture: h(e.onPointerDownCapture, N.onPointerDownCapture)
                    }))
                });

            function I() {
                let e = new CustomEvent(R);
                document.dispatchEvent(e)
            }

            function O(e, t, n, {
                discrete: r
            }) {
                let l = n.originalEvent.target,
                    i = new CustomEvent(e, {
                        bubbles: !1,
                        cancelable: !0,
                        detail: n
                    });
                (t && l.addEventListener(e, t, {
                    once: !0
                }), r) ? l && (0, E.flushSync)(() => l.dispatchEvent(i)): l.dispatchEvent(i)
            }
            let T = "focusScope.autoFocusOnMount",
                N = "focusScope.autoFocusOnUnmount",
                P = {
                    bubbles: !1,
                    cancelable: !0
                },
                A = (0, d.forwardRef)((e, t) => {
                    let {
                        loop: n = !1,
                        trapped: r = !1,
                        onMountAutoFocus: l,
                        onUnmountAutoFocus: i,
                        ...o
                    } = e, [u, a] = (0, d.useState)(null), c = w(l), f = w(i), h = (0, d.useRef)(null), p = v(t, e => a(e)), m = (0, d.useRef)({
                        paused: !1,
                        pause() {
                            this.paused = !0
                        },
                        resume() {
                            this.paused = !1
                        }
                    }).current;
                    (0, d.useEffect)(() => {
                        if (r) {
                            function e(e) {
                                if (m.paused || !u) return;
                                let t = e.target;
                                u.contains(t) ? h.current = t : Z(h.current, {
                                    select: !0
                                })
                            }

                            function t(e) {
                                if (m.paused || !u) return;
                                let t = e.relatedTarget;
                                null === t || u.contains(t) || Z(h.current, {
                                    select: !0
                                })
                            }
                            document.addEventListener("focusin", e), document.addEventListener("focusout", t);
                            let n = new MutationObserver(function(e) {
                                if (document.activeElement === document.body)
                                    for (let t of e) t.removedNodes.length > 0 && Z(u)
                            });
                            return u && n.observe(u, {
                                childList: !0,
                                subtree: !0
                            }), () => {
                                document.removeEventListener("focusin", e), document.removeEventListener("focusout", t), n.disconnect()
                            }
                        }
                    }, [r, u, m.paused]), (0, d.useEffect)(() => {
                        if (u) {
                            z.add(m);
                            let e = document.activeElement;
                            if (!u.contains(e)) {
                                let t = new CustomEvent(T, P);
                                u.addEventListener(T, c), u.dispatchEvent(t), t.defaultPrevented || (function(e, {
                                    select: t = !1
                                } = {}) {
                                    let n = document.activeElement;
                                    for (let r of e)
                                        if (Z(r, {
                                                select: t
                                            }), document.activeElement !== n) return
                                }(F(u).filter(e => "A" !== e.tagName), {
                                    select: !0
                                }), document.activeElement === e && Z(u))
                            }
                            return () => {
                                u.removeEventListener(T, c), setTimeout(() => {
                                    let t = new CustomEvent(N, P);
                                    u.addEventListener(N, f), u.dispatchEvent(t), t.defaultPrevented || Z(null != e ? e : document.body, {
                                        select: !0
                                    }), u.removeEventListener(N, f), z.remove(m)
                                }, 0)
                            }
                        }
                    }, [u, c, f, m]);
                    let g = (0, d.useCallback)(e => {
                        if (!n && !r || m.paused) return;
                        let t = "Tab" === e.key && !e.altKey && !e.ctrlKey && !e.metaKey,
                            l = document.activeElement;
                        if (t && l) {
                            let t = e.currentTarget,
                                [r, i] = function(e) {
                                    let t = F(e);
                                    return [j(t, e), j(t.reverse(), e)]
                                }(t);
                            r && i ? e.shiftKey || l !== i ? e.shiftKey && l === r && (e.preventDefault(), n && Z(i, {
                                select: !0
                            })) : (e.preventDefault(), n && Z(r, {
                                select: !0
                            })) : l === t && e.preventDefault()
                        }
                    }, [n, r, m.paused]);
                    return (0, d.createElement)(M.div, (0, s.Z)({
                        tabIndex: -1
                    }, o, {
                        ref: p,
                        onKeyDown: g
                    }))
                });

            function F(e) {
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

            function j(e, t) {
                for (let n of e)
                    if (! function(e, {
                            upTo: t
                        }) {
                            if ("hidden" === getComputedStyle(e).visibility) return !0;
                            for (; e && (void 0 === t || e !== t);) {
                                if ("none" === getComputedStyle(e).display) return !0;
                                e = e.parentElement
                            }
                            return !1
                        }(n, {
                            upTo: t
                        })) return n
            }

            function Z(e, {
                select: t = !1
            } = {}) {
                if (e && e.focus) {
                    var n;
                    let r = document.activeElement;
                    e.focus({
                        preventScroll: !0
                    }), e !== r && (n = e) instanceof HTMLInputElement && "select" in n && t && e.select()
                }
            }
            let z = (l = [], {
                add(e) {
                    let t = l[0];
                    e !== t && (null == t || t.pause()), (l = _(l, e)).unshift(e)
                },
                remove(e) {
                    var t;
                    null === (t = (l = _(l, e))[0]) || void 0 === t || t.resume()
                }
            });

            function _(e, t) {
                let n = [...e],
                    r = n.indexOf(t);
                return -1 !== r && n.splice(r, 1), n
            }
            let B = (0, d.forwardRef)((e, t) => {
                    var n;
                    let {
                        container: r = null == globalThis ? void 0 : null === (n = globalThis.document) || void 0 === n ? void 0 : n.body,
                        ...l
                    } = e;
                    return r ? E.createPortal((0, d.createElement)(M.div, (0, s.Z)({}, l, {
                        ref: t
                    })), r) : null
                }),
                U = e => {
                    let {
                        present: t,
                        children: n
                    } = e, r = function(e) {
                        var t, n;
                        let [r, l] = (0, d.useState)(), i = (0, d.useRef)({}), o = (0, d.useRef)(e), u = (0, d.useRef)("none"), [a, c] = (t = e ? "mounted" : "unmounted", n = {
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
                        }, (0, d.useReducer)((e, t) => {
                            let r = n[e][t];
                            return null != r ? r : e
                        }, t));
                        return (0, d.useEffect)(() => {
                            let e = q(i.current);
                            u.current = "mounted" === a ? e : "none"
                        }, [a]), m(() => {
                            let t = i.current,
                                n = o.current;
                            if (n !== e) {
                                let r = u.current,
                                    l = q(t);
                                e ? c("MOUNT") : "none" === l || (null == t ? void 0 : t.display) === "none" ? c("UNMOUNT") : n && r !== l ? c("ANIMATION_OUT") : c("UNMOUNT"), o.current = e
                            }
                        }, [e, c]), m(() => {
                            if (r) {
                                let e = e => {
                                        let t = q(i.current).includes(e.animationName);
                                        e.target === r && t && (0, E.flushSync)(() => c("ANIMATION_END"))
                                    },
                                    t = e => {
                                        e.target === r && (u.current = q(i.current))
                                    };
                                return r.addEventListener("animationstart", t), r.addEventListener("animationcancel", e), r.addEventListener("animationend", e), () => {
                                    r.removeEventListener("animationstart", t), r.removeEventListener("animationcancel", e), r.removeEventListener("animationend", e)
                                }
                            }
                            c("ANIMATION_END")
                        }, [r, c]), {
                            isPresent: ["mounted", "unmountSuspended"].includes(a),
                            ref: (0, d.useCallback)(e => {
                                e && (i.current = getComputedStyle(e)), l(e)
                            }, [])
                        }
                    }(t), l = "function" == typeof n ? n({
                        present: r.isPresent
                    }) : d.Children.only(n), i = v(r.ref, l.ref);
                    return "function" == typeof n || r.isPresent ? (0, d.cloneElement)(l, {
                        ref: i
                    }) : null
                };

            function q(e) {
                return (null == e ? void 0 : e.animationName) || "none"
            }
            U.displayName = "Presence";
            let H = 0;

            function K() {
                let e = document.createElement("span");
                return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.cssText = "outline: none; opacity: 0; position: fixed; pointer-events: none", e
            }
            var W = n(37826),
                X = n(92238),
                V = n(16741),
                $ = (0, n(54640)._)(),
                Y = function() {},
                J = d.forwardRef(function(e, t) {
                    var n = d.useRef(null),
                        r = d.useState({
                            onScrollCapture: Y,
                            onWheelCapture: Y,
                            onTouchMoveCapture: Y
                        }),
                        l = r[0],
                        i = r[1],
                        o = e.forwardProps,
                        u = e.children,
                        a = e.className,
                        c = e.removeScrollBar,
                        s = e.enabled,
                        f = e.shards,
                        h = e.sideCar,
                        p = e.noIsolation,
                        v = e.inert,
                        m = e.allowPinchZoom,
                        g = e.as,
                        y = (0, W._T)(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noIsolation", "inert", "allowPinchZoom", "as"]),
                        b = (0, V.q)([n, t]),
                        w = (0, W.pi)((0, W.pi)({}, y), l);
                    return d.createElement(d.Fragment, null, s && d.createElement(h, {
                        sideCar: $,
                        removeScrollBar: c,
                        shards: f,
                        noIsolation: p,
                        inert: v,
                        setCallbacks: i,
                        allowPinchZoom: !!m,
                        lockRef: n
                    }), o ? d.cloneElement(d.Children.only(u), (0, W.pi)((0, W.pi)({}, w), {
                        ref: b
                    })) : d.createElement(void 0 === g ? "div" : g, (0, W.pi)({}, w, {
                        className: a,
                        ref: b
                    }), u))
                });
            J.defaultProps = {
                enabled: !0,
                removeScrollBar: !0,
                inert: !1
            }, J.classNames = {
                fullWidth: X.zi,
                zeroRight: X.pF
            };
            var G = n(30774),
                Q = n(78217),
                ee = n(71339),
                et = !1;
            if ("undefined" != typeof window) try {
                var en = Object.defineProperty({}, "passive", {
                    get: function() {
                        return et = !0, !0
                    }
                });
                window.addEventListener("test", en, en), window.removeEventListener("test", en, en)
            } catch (e) {
                et = !1
            }
            var er = !!et && {
                    passive: !1
                },
                el = function(e, t) {
                    var n = window.getComputedStyle(e);
                    return "hidden" !== n[t] && !(n.overflowY === n.overflowX && "TEXTAREA" !== e.tagName && "visible" === n[t])
                },
                ei = function(e, t) {
                    var n = t;
                    do {
                        if ("undefined" != typeof ShadowRoot && n instanceof ShadowRoot && (n = n.host), eo(e, n)) {
                            var r = eu(e, n);
                            if (r[1] > r[2]) return !0
                        }
                        n = n.parentNode
                    } while (n && n !== document.body);
                    return !1
                },
                eo = function(e, t) {
                    return "v" === e ? el(t, "overflowY") : el(t, "overflowX")
                },
                eu = function(e, t) {
                    return "v" === e ? [t.scrollTop, t.scrollHeight, t.clientHeight] : [t.scrollLeft, t.scrollWidth, t.clientWidth]
                },
                ea = function(e, t, n, r, l) {
                    var i, o = (i = window.getComputedStyle(t).direction, "h" === e && "rtl" === i ? -1 : 1),
                        u = o * r,
                        a = n.target,
                        c = t.contains(a),
                        s = !1,
                        d = u > 0,
                        f = 0,
                        h = 0;
                    do {
                        var p = eu(e, a),
                            v = p[0],
                            m = p[1] - p[2] - o * v;
                        (v || m) && eo(e, a) && (f += m, h += v), a = a.parentNode
                    } while (!c && a !== document.body || c && (t.contains(a) || t === a));
                    return d && (l && 0 === f || !l && u > f) ? s = !0 : !d && (l && 0 === h || !l && -u > h) && (s = !0), s
                },
                ec = function(e) {
                    return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0]
                },
                es = function(e) {
                    return [e.deltaX, e.deltaY]
                },
                ed = function(e) {
                    return e && "current" in e ? e.current : e
                },
                ef = 0,
                eh = [],
                ep = (0, G.L)($, function(e) {
                    var t = d.useRef([]),
                        n = d.useRef([0, 0]),
                        r = d.useRef(),
                        l = d.useState(ef++)[0],
                        i = d.useState(function() {
                            return (0, ee.Ws)()
                        })[0],
                        o = d.useRef(e);
                    d.useEffect(function() {
                        o.current = e
                    }, [e]), d.useEffect(function() {
                        if (e.inert) {
                            document.body.classList.add("block-interactivity-".concat(l));
                            var t = (0, W.ev)([e.lockRef.current], (e.shards || []).map(ed), !0).filter(Boolean);
                            return t.forEach(function(e) {
                                    return e.classList.add("allow-interactivity-".concat(l))
                                }),
                                function() {
                                    document.body.classList.remove("block-interactivity-".concat(l)), t.forEach(function(e) {
                                        return e.classList.remove("allow-interactivity-".concat(l))
                                    })
                                }
                        }
                    }, [e.inert, e.lockRef.current, e.shards]);
                    var u = d.useCallback(function(e, t) {
                            if ("touches" in e && 2 === e.touches.length) return !o.current.allowPinchZoom;
                            var l, i = ec(e),
                                u = n.current,
                                a = "deltaX" in e ? e.deltaX : u[0] - i[0],
                                c = "deltaY" in e ? e.deltaY : u[1] - i[1],
                                s = e.target,
                                d = Math.abs(a) > Math.abs(c) ? "h" : "v";
                            if ("touches" in e && "h" === d && "range" === s.type) return !1;
                            var f = ei(d, s);
                            if (!f) return !0;
                            if (f ? l = d : (l = "v" === d ? "h" : "v", f = ei(d, s)), !f) return !1;
                            if (!r.current && "changedTouches" in e && (a || c) && (r.current = l), !l) return !0;
                            var h = r.current || l;
                            return ea(h, t, e, "h" === h ? a : c, !0)
                        }, []),
                        a = d.useCallback(function(e) {
                            if (eh.length && eh[eh.length - 1] === i) {
                                var n = "deltaY" in e ? es(e) : ec(e),
                                    r = t.current.filter(function(t) {
                                        var r;
                                        return t.name === e.type && t.target === e.target && (r = t.delta)[0] === n[0] && r[1] === n[1]
                                    })[0];
                                if (r && r.should) {
                                    e.cancelable && e.preventDefault();
                                    return
                                }
                                if (!r) {
                                    var l = (o.current.shards || []).map(ed).filter(Boolean).filter(function(t) {
                                        return t.contains(e.target)
                                    });
                                    (l.length > 0 ? u(e, l[0]) : !o.current.noIsolation) && e.cancelable && e.preventDefault()
                                }
                            }
                        }, []),
                        c = d.useCallback(function(e, n, r, l) {
                            var i = {
                                name: e,
                                delta: n,
                                target: r,
                                should: l
                            };
                            t.current.push(i), setTimeout(function() {
                                t.current = t.current.filter(function(e) {
                                    return e !== i
                                })
                            }, 1)
                        }, []),
                        s = d.useCallback(function(e) {
                            n.current = ec(e), r.current = void 0
                        }, []),
                        f = d.useCallback(function(t) {
                            c(t.type, es(t), t.target, u(t, e.lockRef.current))
                        }, []),
                        h = d.useCallback(function(t) {
                            c(t.type, ec(t), t.target, u(t, e.lockRef.current))
                        }, []);
                    d.useEffect(function() {
                        return eh.push(i), e.setCallbacks({
                                onScrollCapture: f,
                                onWheelCapture: f,
                                onTouchMoveCapture: h
                            }), document.addEventListener("wheel", a, er), document.addEventListener("touchmove", a, er), document.addEventListener("touchstart", s, er),
                            function() {
                                eh = eh.filter(function(e) {
                                    return e !== i
                                }), document.removeEventListener("wheel", a, er), document.removeEventListener("touchmove", a, er), document.removeEventListener("touchstart", s, er)
                            }
                    }, []);
                    var p = e.removeScrollBar,
                        v = e.inert;
                    return d.createElement(d.Fragment, null, v ? d.createElement(i, {
                        styles: "\n  .block-interactivity-".concat(l, " {pointer-events: none;}\n  .allow-interactivity-").concat(l, " {pointer-events: all;}\n")
                    }) : null, p ? d.createElement(Q.jp, {
                        gapMode: "margin"
                    }) : null)
                }),
                ev = d.forwardRef(function(e, t) {
                    return d.createElement(J, (0, W.pi)({}, e, {
                        ref: t,
                        sideCar: ep
                    }))
                });
            ev.classNames = J.classNames;
            var em = n(34467);
            let eg = "Dialog",
                [ey, eb] = function(e, t = []) {
                    let n = [],
                        r = () => {
                            let t = n.map(e => (0, d.createContext)(e));
                            return function(n) {
                                let r = (null == n ? void 0 : n[e]) || t;
                                return (0, d.useMemo)(() => ({
                                    [`__scope${e}`]: { ...n,
                                        [e]: r
                                    }
                                }), [n, r])
                            }
                        };
                    return r.scopeName = e, [function(t, r) {
                        let l = (0, d.createContext)(r),
                            i = n.length;

                        function o(t) {
                            let {
                                scope: n,
                                children: r,
                                ...o
                            } = t, u = (null == n ? void 0 : n[e][i]) || l, a = (0, d.useMemo)(() => o, Object.values(o));
                            return (0, d.createElement)(u.Provider, {
                                value: a
                            }, r)
                        }
                        return n = [...n, r], o.displayName = t + "Provider", [o, function(n, o) {
                            let u = (null == o ? void 0 : o[e][i]) || l,
                                a = (0, d.useContext)(u);
                            if (a) return a;
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
                                    let l = n(e)[`__scope${r}`];
                                    return { ...t,
                                        ...l
                                    }
                                }, {});
                                return (0, d.useMemo)(() => ({
                                    [`__scope${t.scopeName}`]: r
                                }), [r])
                            }
                        };
                        return n.scopeName = t.scopeName, n
                    }(r, ...t)]
                }(eg),
                [ew, eE] = ey(eg),
                ex = "DialogPortal",
                [eC, ek] = ey(ex, {
                    forceMount: void 0
                }),
                eD = "DialogOverlay",
                eM = (0, d.forwardRef)((e, t) => {
                    let n = ek(eD, e.__scopeDialog),
                        {
                            forceMount: r = n.forceMount,
                            ...l
                        } = e,
                        i = eE(eD, e.__scopeDialog);
                    return i.modal ? (0, d.createElement)(U, {
                        present: r || i.open
                    }, (0, d.createElement)(eR, (0, s.Z)({}, l, {
                        ref: t
                    }))) : null
                }),
                eR = (0, d.forwardRef)((e, t) => {
                    let {
                        __scopeDialog: n,
                        ...r
                    } = e, l = eE(eD, n);
                    return (0, d.createElement)(ev, {
                        as: x,
                        allowPinchZoom: !0,
                        shards: [l.contentRef]
                    }, (0, d.createElement)(M.div, (0, s.Z)({
                        "data-state": eN(l.open)
                    }, r, {
                        ref: t,
                        style: {
                            pointerEvents: "auto",
                            ...r.style
                        }
                    })))
                }),
                eS = "DialogContent",
                eL = (0, d.forwardRef)((e, t) => {
                    let n = ek(eS, e.__scopeDialog),
                        {
                            forceMount: r = n.forceMount,
                            ...l
                        } = e,
                        i = eE(eS, e.__scopeDialog);
                    return (0, d.createElement)(U, {
                        present: r || i.open
                    }, i.modal ? (0, d.createElement)(eI, (0, s.Z)({}, l, {
                        ref: t
                    })) : (0, d.createElement)(eO, (0, s.Z)({}, l, {
                        ref: t
                    })))
                }),
                eI = (0, d.forwardRef)((e, t) => {
                    let n = eE(eS, e.__scopeDialog),
                        r = (0, d.useRef)(null),
                        l = v(t, n.contentRef, r);
                    return (0, d.useEffect)(() => {
                        let e = r.current;
                        if (e) return (0, em.Ry)(e)
                    }, []), (0, d.createElement)(eT, (0, s.Z)({}, e, {
                        ref: l,
                        trapFocus: n.open,
                        disableOutsidePointerEvents: !0,
                        onCloseAutoFocus: h(e.onCloseAutoFocus, e => {
                            var t;
                            e.preventDefault(), null === (t = n.triggerRef.current) || void 0 === t || t.focus()
                        }),
                        onPointerDownOutside: h(e.onPointerDownOutside, e => {
                            let t = e.detail.originalEvent,
                                n = 0 === t.button && !0 === t.ctrlKey;
                            (2 === t.button || n) && e.preventDefault()
                        }),
                        onFocusOutside: h(e.onFocusOutside, e => e.preventDefault())
                    }))
                }),
                eO = (0, d.forwardRef)((e, t) => {
                    let n = eE(eS, e.__scopeDialog),
                        r = (0, d.useRef)(!1),
                        l = (0, d.useRef)(!1);
                    return (0, d.createElement)(eT, (0, s.Z)({}, e, {
                        ref: t,
                        trapFocus: !1,
                        disableOutsidePointerEvents: !1,
                        onCloseAutoFocus: t => {
                            var i, o;
                            null === (i = e.onCloseAutoFocus) || void 0 === i || i.call(e, t), t.defaultPrevented || (r.current || null === (o = n.triggerRef.current) || void 0 === o || o.focus(), t.preventDefault()), r.current = !1, l.current = !1
                        },
                        onInteractOutside: t => {
                            var i, o;
                            null === (i = e.onInteractOutside) || void 0 === i || i.call(e, t), t.defaultPrevented || (r.current = !0, "pointerdown" !== t.detail.originalEvent.type || (l.current = !0));
                            let u = t.target;
                            (null === (o = n.triggerRef.current) || void 0 === o ? void 0 : o.contains(u)) && t.preventDefault(), "focusin" === t.detail.originalEvent.type && l.current && t.preventDefault()
                        }
                    }))
                }),
                eT = (0, d.forwardRef)((e, t) => {
                    let {
                        __scopeDialog: n,
                        trapFocus: r,
                        onOpenAutoFocus: l,
                        onCloseAutoFocus: i,
                        ...o
                    } = e, u = eE(eS, n), a = v(t, (0, d.useRef)(null));
                    return (0, d.useEffect)(() => {
                        var e, t;
                        let n = document.querySelectorAll("[data-radix-focus-guard]");
                        return document.body.insertAdjacentElement("afterbegin", null !== (e = n[0]) && void 0 !== e ? e : K()), document.body.insertAdjacentElement("beforeend", null !== (t = n[1]) && void 0 !== t ? t : K()), H++, () => {
                            1 === H && document.querySelectorAll("[data-radix-focus-guard]").forEach(e => e.remove()), H--
                        }
                    }, []), (0, d.createElement)(d.Fragment, null, (0, d.createElement)(A, {
                        asChild: !0,
                        loop: !0,
                        trapped: r,
                        onMountAutoFocus: l,
                        onUnmountAutoFocus: i
                    }, (0, d.createElement)(L, (0, s.Z)({
                        role: "dialog",
                        id: u.contentId,
                        "aria-describedby": u.descriptionId,
                        "aria-labelledby": u.titleId,
                        "data-state": eN(u.open)
                    }, o, {
                        ref: a,
                        onDismiss: () => u.onOpenChange(!1)
                    }))), !1)
                });

            function eN(e) {
                return e ? "open" : "closed"
            }
            let [eP, eA] = function(e, t) {
                let n = (0, d.createContext)(t);

                function r(e) {
                    let {
                        children: t,
                        ...r
                    } = e, l = (0, d.useMemo)(() => r, Object.values(r));
                    return (0, d.createElement)(n.Provider, {
                        value: l
                    }, t)
                }
                return r.displayName = e + "Provider", [r, function(r) {
                    let l = (0, d.useContext)(n);
                    if (l) return l;
                    if (void 0 !== t) return t;
                    throw Error(`\`${r}\` must be used within \`${e}\``)
                }]
            }("DialogTitleWarning", {
                contentName: eS,
                titleName: "DialogTitle",
                docsSlug: "dialog"
            }), eF = e => {
                let {
                    __scopeDialog: t,
                    children: n,
                    open: r,
                    defaultOpen: l,
                    onOpenChange: i,
                    modal: o = !0
                } = e, u = (0, d.useRef)(null), a = (0, d.useRef)(null), [c = !1, s] = function({
                    prop: e,
                    defaultProp: t,
                    onChange: n = () => {}
                }) {
                    let [r, l] = function({
                        defaultProp: e,
                        onChange: t
                    }) {
                        let n = (0, d.useState)(e),
                            [r] = n,
                            l = (0, d.useRef)(r),
                            i = w(t);
                        return (0, d.useEffect)(() => {
                            l.current !== r && (i(r), l.current = r)
                        }, [r, l, i]), n
                    }({
                        defaultProp: t,
                        onChange: n
                    }), i = void 0 !== e, o = i ? e : r, u = w(n);
                    return [o, (0, d.useCallback)(t => {
                        if (i) {
                            let n = "function" == typeof t ? t(e) : t;
                            n !== e && u(n)
                        } else l(t)
                    }, [i, e, l, u])]
                }({
                    prop: r,
                    defaultProp: l,
                    onChange: i
                });
                return (0, d.createElement)(ew, {
                    scope: t,
                    triggerRef: u,
                    contentRef: a,
                    contentId: b(),
                    titleId: b(),
                    descriptionId: b(),
                    open: c,
                    onOpenChange: s,
                    onOpenToggle: (0, d.useCallback)(() => s(e => !e), [s]),
                    modal: o
                }, n)
            }, ej = e => {
                let {
                    __scopeDialog: t,
                    forceMount: n,
                    children: r,
                    container: l
                } = e, i = eE(ex, t);
                return (0, d.createElement)(eC, {
                    scope: t,
                    forceMount: n
                }, d.Children.map(r, e => (0, d.createElement)(U, {
                    present: n || i.open
                }, (0, d.createElement)(B, {
                    asChild: !0,
                    container: l
                }, e))))
            };
            var eZ = '[cmdk-group=""]',
                ez = '[cmdk-group-items=""]',
                e_ = '[cmdk-item=""]',
                eB = `${e_}:not([aria-disabled="true"])`,
                eU = "cmdk-item-select",
                eq = "data-value",
                eH = (e, t, n) => {
                    var r;
                    return r = e,
                        function e(t, n, r, l, c, s, d) {
                            if (s === n.length) return c === t.length ? 1 : .99;
                            var f = `${c},${s}`;
                            if (void 0 !== d[f]) return d[f];
                            for (var h, p, v, m, g = l.charAt(s), y = r.indexOf(g, c), b = 0; y >= 0;)(h = e(t, n, r, l, y + 1, s + 1, d)) > b && (y === c ? h *= 1 : i.test(t.charAt(y - 1)) ? (h *= .8, (v = t.slice(c, y - 1).match(o)) && c > 0 && (h *= Math.pow(.999, v.length))) : u.test(t.charAt(y - 1)) ? (h *= .9, (m = t.slice(c, y - 1).match(a)) && c > 0 && (h *= Math.pow(.999, m.length))) : (h *= .17, c > 0 && (h *= Math.pow(.999, y - c))), t.charAt(y) !== n.charAt(s) && (h *= .9999)), (h < .1 && r.charAt(y - 1) === l.charAt(s + 1) || l.charAt(s + 1) === l.charAt(s) && r.charAt(y - 1) !== l.charAt(s)) && .1 * (p = e(t, n, r, l, y + 1, s + 2, d)) > h && (h = .1 * p), h > b && (b = h), y = r.indexOf(g, y + 1);
                            return d[f] = b, b
                        }(r = n && n.length > 0 ? `${r+" "+n.join(" ")}` : r, t, c(r), c(t), 0, 0, {})
                },
                eK = d.createContext(void 0),
                eW = () => d.useContext(eK),
                eX = d.createContext(void 0),
                eV = () => d.useContext(eX),
                e$ = d.createContext(void 0),
                eY = d.forwardRef((e, t) => {
                    let n = e9(() => {
                            var t, n;
                            return {
                                search: "",
                                value: null != (n = null != (t = e.value) ? t : e.defaultValue) ? n : "",
                                filtered: {
                                    count: 0,
                                    items: new Map,
                                    groups: new Set
                                }
                            }
                        }),
                        r = e9(() => new Set),
                        l = e9(() => new Map),
                        i = e9(() => new Map),
                        o = e9(() => new Set),
                        u = e5(e),
                        {
                            label: a,
                            children: c,
                            value: s,
                            onValueChange: f,
                            filter: h,
                            shouldFilter: p,
                            loop: v,
                            disablePointerSelection: m = !1,
                            vimBindings: g = !0,
                            ...y
                        } = e,
                        b = d.useId(),
                        w = d.useId(),
                        E = d.useId(),
                        x = d.useRef(null),
                        C = te();
                    e3(() => {
                        if (void 0 !== s) {
                            let e = s.trim();
                            n.current.value = e, k.emit()
                        }
                    }, [s]), e3(() => {
                        C(6, O)
                    }, []);
                    let k = d.useMemo(() => ({
                            subscribe: e => (o.current.add(e), () => o.current.delete(e)),
                            snapshot: () => n.current,
                            setState: (e, t, r) => {
                                var l, i, o;
                                if (!Object.is(n.current[e], t)) {
                                    if (n.current[e] = t, "search" === e) I(), S(), C(1, L);
                                    else if ("value" === e && (r || C(5, O), (null == (l = u.current) ? void 0 : l.value) !== void 0)) {
                                        null == (o = (i = u.current).onValueChange) || o.call(i, null != t ? t : "");
                                        return
                                    }
                                    k.emit()
                                }
                            },
                            emit: () => {
                                o.current.forEach(e => e())
                            }
                        }), []),
                        D = d.useMemo(() => ({
                            value: (e, t, r) => {
                                var l;
                                t !== (null == (l = i.current.get(e)) ? void 0 : l.value) && (i.current.set(e, {
                                    value: t,
                                    keywords: r
                                }), n.current.filtered.items.set(e, R(t, r)), C(2, () => {
                                    S(), k.emit()
                                }))
                            },
                            item: (e, t) => (r.current.add(e), t && (l.current.has(t) ? l.current.get(t).add(e) : l.current.set(t, new Set([e]))), C(3, () => {
                                I(), S(), n.current.value || L(), k.emit()
                            }), () => {
                                i.current.delete(e), r.current.delete(e), n.current.filtered.items.delete(e);
                                let t = T();
                                C(4, () => {
                                    I(), (null == t ? void 0 : t.getAttribute("id")) === e && L(), k.emit()
                                })
                            }),
                            group: e => (l.current.has(e) || l.current.set(e, new Set), () => {
                                i.current.delete(e), l.current.delete(e)
                            }),
                            filter: () => u.current.shouldFilter,
                            label: a || e["aria-label"],
                            disablePointerSelection: m,
                            listId: b,
                            inputId: E,
                            labelId: w,
                            listInnerRef: x
                        }), []);

                    function R(e, t) {
                        var r, l;
                        let i = null != (l = null == (r = u.current) ? void 0 : r.filter) ? l : eH;
                        return e ? i(e, n.current.search, t) : 0
                    }

                    function S() {
                        if (!n.current.search || !1 === u.current.shouldFilter) return;
                        let e = n.current.filtered.items,
                            t = [];
                        n.current.filtered.groups.forEach(n => {
                            let r = l.current.get(n),
                                i = 0;
                            r.forEach(t => {
                                i = Math.max(e.get(t), i)
                            }), t.push([n, i])
                        });
                        let r = x.current;
                        N().sort((t, n) => {
                            var r, l;
                            let i = t.getAttribute("id"),
                                o = n.getAttribute("id");
                            return (null != (r = e.get(o)) ? r : 0) - (null != (l = e.get(i)) ? l : 0)
                        }).forEach(e => {
                            let t = e.closest(ez);
                            t ? t.appendChild(e.parentElement === t ? e : e.closest(`${ez} > *`)) : r.appendChild(e.parentElement === r ? e : e.closest(`${ez} > *`))
                        }), t.sort((e, t) => t[1] - e[1]).forEach(e => {
                            let t = x.current.querySelector(`${eZ}[${eq}="${encodeURIComponent(e[0])}"]`);
                            null == t || t.parentElement.appendChild(t)
                        })
                    }

                    function L() {
                        let e = N().find(e => "true" !== e.getAttribute("aria-disabled")),
                            t = null == e ? void 0 : e.getAttribute(eq);
                        k.setState("value", t || void 0)
                    }

                    function I() {
                        var e, t, o, a;
                        if (!n.current.search || !1 === u.current.shouldFilter) {
                            n.current.filtered.count = r.current.size;
                            return
                        }
                        n.current.filtered.groups = new Set;
                        let c = 0;
                        for (let l of r.current) {
                            let r = R(null != (t = null == (e = i.current.get(l)) ? void 0 : e.value) ? t : "", null != (a = null == (o = i.current.get(l)) ? void 0 : o.keywords) ? a : []);
                            n.current.filtered.items.set(l, r), r > 0 && c++
                        }
                        for (let [e, t] of l.current)
                            for (let r of t)
                                if (n.current.filtered.items.get(r) > 0) {
                                    n.current.filtered.groups.add(e);
                                    break
                                }
                        n.current.filtered.count = c
                    }

                    function O() {
                        var e, t, n;
                        let r = T();
                        r && ((null == (e = r.parentElement) ? void 0 : e.firstChild) === r && (null == (n = null == (t = r.closest(eZ)) ? void 0 : t.querySelector('[cmdk-group-heading=""]')) || n.scrollIntoView({
                            block: "nearest"
                        })), r.scrollIntoView({
                            block: "nearest"
                        }))
                    }

                    function T() {
                        var e;
                        return null == (e = x.current) ? void 0 : e.querySelector(`${e_}[aria-selected="true"]`)
                    }

                    function N() {
                        var e;
                        return Array.from(null == (e = x.current) ? void 0 : e.querySelectorAll(eB))
                    }

                    function P(e) {
                        let t = N()[e];
                        t && k.setState("value", t.getAttribute(eq))
                    }

                    function A(e) {
                        var t;
                        let n = T(),
                            r = N(),
                            l = r.findIndex(e => e === n),
                            i = r[l + e];
                        null != (t = u.current) && t.loop && (i = l + e < 0 ? r[r.length - 1] : l + e === r.length ? r[0] : r[l + e]), i && k.setState("value", i.getAttribute(eq))
                    }

                    function F(e) {
                        let t = T(),
                            n = null == t ? void 0 : t.closest(eZ),
                            r;
                        for (; n && !r;) r = null == (n = e > 0 ? function(e, t) {
                            let n = e.nextElementSibling;
                            for (; n;) {
                                if (n.matches(t)) return n;
                                n = n.nextElementSibling
                            }
                        }(n, eZ) : function(e, t) {
                            let n = e.previousElementSibling;
                            for (; n;) {
                                if (n.matches(t)) return n;
                                n = n.previousElementSibling
                            }
                        }(n, eZ)) ? void 0 : n.querySelector(eB);
                        r ? k.setState("value", r.getAttribute(eq)) : A(e)
                    }
                    let j = () => P(N().length - 1),
                        Z = e => {
                            e.preventDefault(), e.metaKey ? j() : e.altKey ? F(1) : A(1)
                        },
                        z = e => {
                            e.preventDefault(), e.metaKey ? P(0) : e.altKey ? F(-1) : A(-1)
                        };
                    return d.createElement(M.div, {
                        ref: t,
                        tabIndex: -1,
                        ...y,
                        "cmdk-root": "",
                        onKeyDown: e => {
                            var t;
                            if (null == (t = y.onKeyDown) || t.call(y, e), !e.defaultPrevented) switch (e.key) {
                                case "n":
                                case "j":
                                    g && e.ctrlKey && Z(e);
                                    break;
                                case "ArrowDown":
                                    Z(e);
                                    break;
                                case "p":
                                case "k":
                                    g && e.ctrlKey && z(e);
                                    break;
                                case "ArrowUp":
                                    z(e);
                                    break;
                                case "Home":
                                    e.preventDefault(), P(0);
                                    break;
                                case "End":
                                    e.preventDefault(), j();
                                    break;
                                case "Enter":
                                    if (!e.nativeEvent.isComposing && 229 !== e.keyCode) {
                                        e.preventDefault();
                                        let t = T();
                                        if (t) {
                                            let e = new Event(eU);
                                            t.dispatchEvent(e)
                                        }
                                    }
                            }
                        }
                    }, d.createElement("label", {
                        "cmdk-label": "",
                        htmlFor: D.inputId,
                        id: D.labelId,
                        style: tn
                    }, a), tt(e, e => d.createElement(eX.Provider, {
                        value: k
                    }, d.createElement(eK.Provider, {
                        value: D
                    }, e))))
                }),
                eJ = d.forwardRef((e, t) => {
                    var n, r;
                    let l = d.useId(),
                        i = d.useRef(null),
                        o = d.useContext(e$),
                        u = eW(),
                        a = e5(e),
                        c = null != (r = null == (n = a.current) ? void 0 : n.forceMount) ? r : null == o ? void 0 : o.forceMount;
                    e3(() => {
                        if (!c) return u.item(l, null == o ? void 0 : o.id)
                    }, [c]);
                    let s = e7(l, i, [e.value, e.children, i], e.keywords),
                        f = eV(),
                        h = e6(e => e.value && e.value === s.current),
                        p = e6(e => !!c || !1 === u.filter() || !e.search || e.filtered.items.get(l) > 0);

                    function v() {
                        var e, t;
                        m(), null == (t = (e = a.current).onSelect) || t.call(e, s.current)
                    }

                    function m() {
                        f.setState("value", s.current, !0)
                    }
                    if (d.useEffect(() => {
                            let t = i.current;
                            if (!(!t || e.disabled)) return t.addEventListener(eU, v), () => t.removeEventListener(eU, v)
                        }, [p, e.onSelect, e.disabled]), !p) return null;
                    let {
                        disabled: g,
                        value: y,
                        onSelect: b,
                        forceMount: w,
                        keywords: E,
                        ...x
                    } = e;
                    return d.createElement(M.div, {
                        ref: e4([i, t]),
                        ...x,
                        id: l,
                        "cmdk-item": "",
                        role: "option",
                        "aria-disabled": !!g,
                        "aria-selected": !!h,
                        "data-disabled": !!g,
                        "data-selected": !!h,
                        onPointerMove: g || u.disablePointerSelection ? void 0 : m,
                        onClick: g ? void 0 : v
                    }, e.children)
                }),
                eG = d.forwardRef((e, t) => {
                    let {
                        heading: n,
                        children: r,
                        forceMount: l,
                        ...i
                    } = e, o = d.useId(), u = d.useRef(null), a = d.useRef(null), c = d.useId(), s = eW(), f = e6(e => !!l || !1 === s.filter() || !e.search || e.filtered.groups.has(o));
                    e3(() => s.group(o), []), e7(o, u, [e.value, e.heading, a]);
                    let h = d.useMemo(() => ({
                        id: o,
                        forceMount: l
                    }), [l]);
                    return d.createElement(M.div, {
                        ref: e4([u, t]),
                        ...i,
                        "cmdk-group": "",
                        role: "presentation",
                        hidden: !f || void 0
                    }, n && d.createElement("div", {
                        ref: a,
                        "cmdk-group-heading": "",
                        "aria-hidden": !0,
                        id: c
                    }, n), tt(e, e => d.createElement("div", {
                        "cmdk-group-items": "",
                        role: "group",
                        "aria-labelledby": n ? c : void 0
                    }, d.createElement(e$.Provider, {
                        value: h
                    }, e))))
                }),
                eQ = d.forwardRef((e, t) => {
                    let {
                        alwaysRender: n,
                        ...r
                    } = e, l = d.useRef(null), i = e6(e => !e.search);
                    return n || i ? d.createElement(M.div, {
                        ref: e4([l, t]),
                        ...r,
                        "cmdk-separator": "",
                        role: "separator"
                    }) : null
                }),
                e0 = d.forwardRef((e, t) => {
                    let {
                        onValueChange: n,
                        ...r
                    } = e, l = null != e.value, i = eV(), o = e6(e => e.search), u = e6(e => e.value), a = eW(), c = d.useMemo(() => {
                        var e;
                        let t = null == (e = a.listInnerRef.current) ? void 0 : e.querySelector(`${e_}[${eq}="${encodeURIComponent(u)}"]`);
                        return null == t ? void 0 : t.getAttribute("id")
                    }, []);
                    return d.useEffect(() => {
                        null != e.value && i.setState("search", e.value)
                    }, [e.value]), d.createElement(M.input, {
                        ref: t,
                        ...r,
                        "cmdk-input": "",
                        autoComplete: "off",
                        autoCorrect: "off",
                        spellCheck: !1,
                        "aria-autocomplete": "list",
                        role: "combobox",
                        "aria-expanded": !0,
                        "aria-controls": a.listId,
                        "aria-labelledby": a.labelId,
                        "aria-activedescendant": c,
                        id: a.inputId,
                        type: "text",
                        value: l ? e.value : o,
                        onChange: e => {
                            l || i.setState("search", e.target.value), null == n || n(e.target.value)
                        }
                    })
                }),
                e1 = d.forwardRef((e, t) => {
                    let {
                        children: n,
                        label: r = "Suggestions",
                        ...l
                    } = e, i = d.useRef(null), o = d.useRef(null), u = eW();
                    return d.useEffect(() => {
                        if (o.current && i.current) {
                            let e = o.current,
                                t = i.current,
                                n, r = new ResizeObserver(() => {
                                    n = requestAnimationFrame(() => {
                                        let n = e.offsetHeight;
                                        t.style.setProperty("--cmdk-list-height", n.toFixed(1) + "px")
                                    })
                                });
                            return r.observe(e), () => {
                                cancelAnimationFrame(n), r.unobserve(e)
                            }
                        }
                    }, []), d.createElement(M.div, {
                        ref: e4([i, t]),
                        ...l,
                        "cmdk-list": "",
                        role: "listbox",
                        "aria-label": r,
                        id: u.listId
                    }, tt(e, e => d.createElement("div", {
                        ref: e4([o, u.listInnerRef]),
                        "cmdk-list-sizer": ""
                    }, e)))
                }),
                e2 = d.forwardRef((e, t) => {
                    let {
                        open: n,
                        onOpenChange: r,
                        overlayClassName: l,
                        contentClassName: i,
                        container: o,
                        ...u
                    } = e;
                    return d.createElement(eF, {
                        open: n,
                        onOpenChange: r
                    }, d.createElement(ej, {
                        container: o
                    }, d.createElement(eM, {
                        "cmdk-overlay": "",
                        className: l
                    }), d.createElement(eL, {
                        "aria-label": e.label,
                        "cmdk-dialog": "",
                        className: i
                    }, d.createElement(eY, {
                        ref: t,
                        ...u
                    }))))
                }),
                e8 = Object.assign(eY, {
                    List: e1,
                    Item: eJ,
                    Input: e0,
                    Group: eG,
                    Separator: eQ,
                    Dialog: e2,
                    Empty: d.forwardRef((e, t) => e6(e => 0 === e.filtered.count) ? d.createElement(M.div, {
                        ref: t,
                        ...e,
                        "cmdk-empty": "",
                        role: "presentation"
                    }) : null),
                    Loading: d.forwardRef((e, t) => {
                        let {
                            progress: n,
                            children: r,
                            label: l = "Loading...",
                            ...i
                        } = e;
                        return d.createElement(M.div, {
                            ref: t,
                            ...i,
                            "cmdk-loading": "",
                            role: "progressbar",
                            "aria-valuenow": n,
                            "aria-valuemin": 0,
                            "aria-valuemax": 100,
                            "aria-label": l
                        }, tt(e, e => d.createElement("div", {
                            "aria-hidden": !0
                        }, e)))
                    })
                });

            function e5(e) {
                let t = d.useRef(e);
                return e3(() => {
                    t.current = e
                }), t
            }
            var e3 = "undefined" == typeof window ? d.useEffect : d.useLayoutEffect;

            function e9(e) {
                let t = d.useRef();
                return void 0 === t.current && (t.current = e()), t
            }

            function e4(e) {
                return t => {
                    e.forEach(e => {
                        "function" == typeof e ? e(t) : null != e && (e.current = t)
                    })
                }
            }

            function e6(e) {
                let t = eV(),
                    n = () => e(t.snapshot());
                return d.useSyncExternalStore(t.subscribe, n, n)
            }

            function e7(e, t, n, r = []) {
                let l = d.useRef(),
                    i = eW();
                return e3(() => {
                    var o;
                    let u = (() => {
                            var e;
                            for (let t of n) {
                                if ("string" == typeof t) return t.trim();
                                if ("object" == typeof t && "current" in t) return t.current ? null == (e = t.current.textContent) ? void 0 : e.trim() : l.current
                            }
                        })(),
                        a = r.map(e => e.trim());
                    i.value(e, u, a), null == (o = t.current) || o.setAttribute(eq, u), l.current = u
                }), l
            }
            var te = () => {
                let [e, t] = d.useState(), n = e9(() => new Map);
                return e3(() => {
                    n.current.forEach(e => e()), n.current = new Map
                }, [e]), (e, r) => {
                    n.current.set(e, r), t({})
                }
            };

            function tt({
                asChild: e,
                children: t
            }, n) {
                let r;
                return e && d.isValidElement(t) ? d.cloneElement("function" == typeof(r = t.type) ? r(t.props) : "render" in r ? r.render(t.props) : t, {
                    ref: t.ref
                }, n(t.props.children)) : n(t)
            }
            var tn = {
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: "0",
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                borderWidth: "0"
            }
        },
        85922: function(e, t, n) {
            n.d(t, {
                M: function() {
                    return g
                }
            });
            var r = n(10131),
                l = n(55185),
                i = n(21891),
                o = n(56936),
                u = n(70150);
            class a extends l.Component {
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

            function c(e) {
                let {
                    children: t,
                    isPresent: n
                } = e, i = (0, l.useId)(), o = (0, l.useRef)(null), c = (0, l.useRef)({
                    width: 0,
                    height: 0,
                    top: 0,
                    left: 0
                }), {
                    nonce: s
                } = (0, l.useContext)(u._);
                return (0, l.useInsertionEffect)(() => {
                    let {
                        width: e,
                        height: t,
                        top: r,
                        left: l
                    } = c.current;
                    if (n || !o.current || !e || !t) return;
                    o.current.dataset.motionPopId = i;
                    let u = document.createElement("style");
                    return s && (u.nonce = s), document.head.appendChild(u), u.sheet && u.sheet.insertRule('\n          [data-motion-pop-id="'.concat(i, '"] {\n            position: absolute !important;\n            width: ').concat(e, "px !important;\n            height: ").concat(t, "px !important;\n            top: ").concat(r, "px !important;\n            left: ").concat(l, "px !important;\n          }\n        ")), () => {
                        document.head.removeChild(u)
                    }
                }, [n]), (0, r.jsx)(a, {
                    isPresent: n,
                    childRef: o,
                    sizeRef: c,
                    children: l.cloneElement(t, {
                        ref: o
                    })
                })
            }
            let s = e => {
                let {
                    children: t,
                    initial: n,
                    isPresent: u,
                    onExitComplete: a,
                    custom: s,
                    presenceAffectsLayout: f,
                    mode: h
                } = e, p = (0, o.h)(d), v = (0, l.useId)(), m = (0, l.useCallback)(e => {
                    for (let t of (p.set(e, !0), p.values()))
                        if (!t) return;
                    a && a()
                }, [p, a]), g = (0, l.useMemo)(() => ({
                    id: v,
                    initial: n,
                    isPresent: u,
                    custom: s,
                    onExitComplete: m,
                    register: e => (p.set(e, !1), () => p.delete(e))
                }), f ? [Math.random(), m] : [u, m]);
                return (0, l.useMemo)(() => {
                    p.forEach((e, t) => p.set(t, !1))
                }, [u]), l.useEffect(() => {
                    u || p.size || !a || a()
                }, [u]), "popLayout" === h && (t = (0, r.jsx)(c, {
                    isPresent: u,
                    children: t
                })), (0, r.jsx)(i.O.Provider, {
                    value: g,
                    children: t
                })
            };

            function d() {
                return new Map
            }
            var f = n(77202),
                h = n(43448);
            let p = e => e.key || "";

            function v(e) {
                let t = [];
                return l.Children.forEach(e, e => {
                    (0, l.isValidElement)(e) && t.push(e)
                }), t
            }
            var m = n(23258);
            let g = e => {
                let {
                    children: t,
                    exitBeforeEnter: n,
                    custom: i,
                    initial: u = !0,
                    onExitComplete: a,
                    presenceAffectsLayout: c = !0,
                    mode: d = "sync"
                } = e;
                (0, h.k)(!n, "Replace exitBeforeEnter with mode='wait'");
                let g = (0, l.useMemo)(() => v(t), [t]),
                    y = g.map(p),
                    b = (0, l.useRef)(!0),
                    w = (0, l.useRef)(g),
                    E = (0, o.h)(() => new Map),
                    [x, C] = (0, l.useState)(g),
                    [k, D] = (0, l.useState)(g);
                (0, m.L)(() => {
                    b.current = !1, w.current = g;
                    for (let e = 0; e < k.length; e++) {
                        let t = p(k[e]);
                        y.includes(t) ? E.delete(t) : !0 !== E.get(t) && E.set(t, !1)
                    }
                }, [k, y.length, y.join("-")]);
                let M = [];
                if (g !== x) {
                    let e = [...g];
                    for (let t = 0; t < k.length; t++) {
                        let n = k[t],
                            r = p(n);
                        y.includes(r) || (e.splice(t, 0, n), M.push(n))
                    }
                    "wait" === d && M.length && (e = M), D(v(e)), C(g);
                    return
                }
                let {
                    forceRender: R
                } = (0, l.useContext)(f.p);
                return (0, r.jsx)(r.Fragment, {
                    children: k.map(e => {
                        let t = p(e),
                            n = g === k || y.includes(t);
                        return (0, r.jsx)(s, {
                            isPresent: n,
                            initial: (!b.current || !!u) && void 0,
                            custom: n ? void 0 : i,
                            presenceAffectsLayout: c,
                            mode: d,
                            onExitComplete: n ? void 0 : () => {
                                if (!E.has(t)) return;
                                E.set(t, !0);
                                let e = !0;
                                E.forEach(t => {
                                    t || (e = !1)
                                }), e && (null == R || R(), D(w.current), a && a())
                            },
                            children: e
                        }, t)
                    })
                })
            }
        }
    }
]);