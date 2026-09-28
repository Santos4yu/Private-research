(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [6470], {
        2238: function(e, l, t) {
            Promise.resolve().then(t.bind(t, 23267))
        },
        76188: function(e, l, t) {
            "use strict";
            t.d(l, {
                Z: function() {
                    return o
                }
            });
            var n = t(55185);
            let r = e => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
                a = function() {
                    for (var e = arguments.length, l = Array(e), t = 0; t < e; t++) l[t] = arguments[t];
                    return l.filter((e, l, t) => !!e && t.indexOf(e) === l).join(" ")
                };
            var s = {
                xmlns: "http://www.w3.org/2000/svg",
                width: 24,
                height: 24,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeLinejoin: "round"
            };
            let i = (0, n.forwardRef)((e, l) => {
                    let {
                        color: t = "currentColor",
                        size: r = 24,
                        strokeWidth: i = 2,
                        absoluteStrokeWidth: o,
                        className: d = "",
                        children: c,
                        iconNode: u,
                        ...m
                    } = e;
                    return (0, n.createElement)("svg", {
                        ref: l,
                        ...s,
                        width: r,
                        height: r,
                        stroke: t,
                        strokeWidth: o ? 24 * Number(i) / Number(r) : i,
                        className: a("lucide", d),
                        ...m
                    }, [...u.map(e => {
                        let [l, t] = e;
                        return (0, n.createElement)(l, t)
                    }), ...Array.isArray(c) ? c : [c]])
                }),
                o = (e, l) => {
                    let t = (0, n.forwardRef)((t, s) => {
                        let {
                            className: o,
                            ...d
                        } = t;
                        return (0, n.createElement)(i, {
                            ref: s,
                            iconNode: l,
                            className: a("lucide-".concat(r(e)), o),
                            ...d
                        })
                    });
                    return t.displayName = "".concat(e), t
                }
        },
        76840: function(e, l, t) {
            "use strict";
            t.d(l, {
                Z: function() {
                    return n
                }
            });
            let n = (0, t(76188).Z)("TriangleAlert", [
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
        23267: function(e, l, t) {
            "use strict";
            t.r(l), t.d(l, {
                default: function() {
                    return c
                }
            });
            var n, r = t(10131);
            t(98496);
            var a = t(55185),
                s = t(13010),
                i = t.n(s),
                o = t(76840);
            let d = null !== (n = "99d9b41f0da9eaef919439aac50698bb9b94f879".slice(0, 7)) && void 0 !== n ? n : null;

            function c(e) {
                var l, t, n, s, c, u, m, x, h;
                let {
                    error: p,
                    reset: g
                } = e, [f, v] = (0, a.useState)(null), [b, w] = (0, a.useState)(!1);
                (0, a.useEffect)(() => {
                    console.error("[GlobalError]", p);
                    let e = null;
                    try {
                        var l, t, n;
                        e = null !== (n = null === (t = window.Clerk) || void 0 === t ? void 0 : null === (l = t.user) || void 0 === l ? void 0 : l.id) && void 0 !== n ? n : null
                    } catch (e) {}
                    v({
                        path: "".concat(window.location.pathname).concat(window.location.search),
                        userAgent: navigator.userAgent,
                        userId: e,
                        time: new Date().toISOString()
                    })
                }, [p]);
                let y = window.location.origin,
                    k = (null !== (l = null == p ? void 0 : p.stack) && void 0 !== l ? l : "").split("\n").map(e => e.trim().replace(y, "")).filter(Boolean).slice(0, 8).join("\n"),
                    N = ["Path: ".concat(null !== (t = null == f ? void 0 : f.path) && void 0 !== t ? t : ""), "Error: ".concat(null !== (n = null == p ? void 0 : p.name) && void 0 !== n ? n : "Error", ": ").concat((null == p ? void 0 : p.message) || "Unknown error"), (null == p ? void 0 : p.digest) ? "Digest: ".concat(p.digest) : null, "Time: ".concat(null !== (s = null == f ? void 0 : f.time) && void 0 !== s ? s : ""), d ? "Build: ".concat(d) : null, (null == f ? void 0 : f.userId) ? "User: ".concat(f.userId) : null, "Device: ".concat(null !== (c = null == f ? void 0 : f.userAgent) && void 0 !== c ? c : ""), k ? "Stack:\n".concat(k) : null].filter(Boolean).join("\n"),
                    j = async () => {
                        try {
                            await navigator.clipboard.writeText(N), w(!0)
                        } catch (e) {}
                    };
                return (0, r.jsx)("html", {
                    lang: "en",
                    className: i().variable,
                    children: (0, r.jsx)("body", {
                        className: "antialiased font-layout",
                        style: {
                            backgroundColor: "#030712",
                            color: "#e2e8f0",
                            margin: 0,
                            minHeight: "100dvh"
                        },
                        children: (0, r.jsxs)("div", {
                            className: "mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col items-center gap-6 px-4 py-10",
                            children: [(0, r.jsxs)("div", {
                                className: "flex flex-col items-center gap-2 text-center",
                                children: [(0, r.jsx)(o.Z, {
                                    className: "mb-2 h-10 w-10 text-primary"
                                }), (0, r.jsx)("h1", {
                                    className: "silver-text text-xl font-semibold",
                                    children: "Something went wrong"
                                }), (0, r.jsxs)("p", {
                                    className: "px-4 text-sm text-gray-400",
                                    children: ["Please screenshot this page and send it to", " ", (0, r.jsx)("a", {
                                        href: "mailto:support@pickfinder.app",
                                        className: "text-blue-300",
                                        children: "support@pickfinder.app"
                                    }), " ", "or tag an admin in Discord — it has everything we need to fix it."]
                                })]
                            }), (0, r.jsxs)("div", {
                                className: "flex w-full flex-col gap-3 rounded-lg border border-bordergray bg-slate-850/30 p-4 text-left",
                                children: [(0, r.jsxs)("div", {
                                    children: [(0, r.jsx)("p", {
                                        className: "text-[11px] font-semibold uppercase tracking-wide text-gray-500",
                                        children: "Path"
                                    }), (0, r.jsx)("p", {
                                        className: "break-all text-sm text-gray-200",
                                        children: null !== (u = null == f ? void 0 : f.path) && void 0 !== u ? u : "…"
                                    })]
                                }), (0, r.jsxs)("div", {
                                    children: [(0, r.jsx)("p", {
                                        className: "text-[11px] font-semibold uppercase tracking-wide text-gray-500",
                                        children: "Error"
                                    }), (0, r.jsxs)("p", {
                                        className: "break-words text-sm text-red-300",
                                        children: [null !== (m = null == p ? void 0 : p.name) && void 0 !== m ? m : "Error", ": ", (null == p ? void 0 : p.message) || "Unknown error"]
                                    })]
                                }), (0, r.jsxs)("div", {
                                    className: "grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400",
                                    children: [(0, r.jsxs)("span", {
                                        children: ["Time: ", null !== (x = null == f ? void 0 : f.time) && void 0 !== x ? x : "…"]
                                    }), d ? (0, r.jsxs)("span", {
                                        children: ["Build: ", d]
                                    }) : null, (null == p ? void 0 : p.digest) ? (0, r.jsxs)("span", {
                                        className: "col-span-2 break-all",
                                        children: ["Digest: ", p.digest]
                                    }) : null, (null == f ? void 0 : f.userId) ? (0, r.jsxs)("span", {
                                        className: "col-span-2 break-all",
                                        children: ["User: ", f.userId]
                                    }) : null]
                                }), (0, r.jsx)("p", {
                                    className: "break-all text-[11px] leading-4 text-gray-500",
                                    children: null !== (h = null == f ? void 0 : f.userAgent) && void 0 !== h ? h : ""
                                }), k ? (0, r.jsx)("pre", {
                                    className: "max-w-full whitespace-pre-wrap break-all rounded-md bg-black/40 p-2 font-mono text-[10px] leading-4 text-gray-400",
                                    children: k
                                }) : null]
                            }), (0, r.jsxs)("div", {
                                className: "flex w-full flex-col gap-2 sm:flex-row",
                                children: [(0, r.jsx)("button", {
                                    type: "button",
                                    onClick: () => window.location.reload(),
                                    className: "h-10 w-full rounded-md bg-white text-sm font-medium text-black hover:bg-gray-200",
                                    children: "Refresh page"
                                }), (0, r.jsx)("button", {
                                    type: "button",
                                    onClick: g,
                                    className: "h-10 w-full rounded-md border border-bordergray text-sm font-medium text-primary hover:bg-slate-850/50",
                                    children: "Try again"
                                }), (0, r.jsx)("button", {
                                    type: "button",
                                    onClick: j,
                                    className: "h-10 w-full rounded-md border border-bordergray text-sm font-medium text-primary hover:bg-slate-850/50",
                                    children: b ? "Copied" : "Copy details"
                                })]
                            }), (0, r.jsx)("a", {
                                href: "/",
                                className: "text-xs text-gray-500 hover:text-gray-300",
                                children: "Return home"
                            })]
                        })
                    })
                })
            }
        },
        98496: function() {},
        13010: function(e) {
            e.exports = {
                style: {
                    fontFamily: "'__GeistSans_8adcd2', '__GeistSans_Fallback_8adcd2'"
                },
                className: "__className_8adcd2",
                variable: "__variable_8adcd2"
            }
        }
    },
    function(e) {
        e.O(0, [3183, 2822, 5552, 1355, 1744], function() {
            return e(e.s = 2238)
        }), _N_E = e.O()
    }
]);