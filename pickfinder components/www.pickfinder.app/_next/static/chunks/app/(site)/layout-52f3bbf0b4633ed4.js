(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [7457], {
        39306: function(e, t, r) {
            Promise.resolve().then(r.t.bind(r, 84640, 23)), Promise.resolve().then(r.t.bind(r, 49479, 23)), Promise.resolve().then(r.t.bind(r, 97926, 23)), Promise.resolve().then(r.bind(r, 90070)), Promise.resolve().then(r.bind(r, 25832)), Promise.resolve().then(r.bind(r, 94871)), Promise.resolve().then(r.bind(r, 77252)), Promise.resolve().then(r.bind(r, 71384)), Promise.resolve().then(r.bind(r, 77941))
        },
        90070: function(e, t, r) {
            "use strict";

            function n() {
                return null
            }
            r.d(t, {
                default: function() {
                    return n
                }
            }), r(10131), r(76840)
        },
        25832: function(e, t, r) {
            "use strict";
            r.d(t, {
                default: function() {
                    return c
                }
            });
            var n = r(10131),
                a = r(70434),
                s = r.n(a),
                i = r(55185),
                o = r(67057),
                l = r(43336);
            let d = e => e.toString().padStart(2, "0");
            var c = () => {
                let e = (0, o.usePathname)(),
                    {
                        countdown: t,
                        isExpired: r
                    } = function() {
                        let [e, t] = (0, i.useState)(null), [r, n] = (0, i.useState)(!1);
                        return (0, i.useEffect)(() => {
                            let e = new Date(l.h0.endsAt).getTime(),
                                r = () => {
                                    let r = e - Date.now();
                                    if (r <= 0) {
                                        n(!0), t(null);
                                        return
                                    }
                                    t("".concat(d(Math.floor(r / 36e5)), ":").concat(d(Math.floor(r % 36e5 / 6e4)), ":").concat(d(Math.floor(r % 6e4 / 1e3))))
                                };
                            r();
                            let a = setInterval(r, 1e3);
                            return () => clearInterval(a)
                        }, []), {
                            countdown: e,
                            isExpired: r
                        }
                    }(),
                    [a, c] = (0, i.useState)(!1);
                if ((0, i.useEffect)(() => {
                        if ("dialog" !== l.h0.mode) return;
                        let e = () => c("1" === localStorage.getItem(l.sE));
                        return e(), window.addEventListener(l.Vu, e), window.addEventListener("storage", e), () => {
                            window.removeEventListener(l.Vu, e), window.removeEventListener("storage", e)
                        }
                    }, []), "off" === l.h0.mode || "dialog" === l.h0.mode && !a || !(0, l.fr)(e) || r || !t) return null;
                let u = () => (0, n.jsxs)("span", {
                    className: "flex shrink-0 items-center gap-1.5 px-4 text-[13px]",
                    children: [(0, n.jsx)("span", {
                        children: l.h0.emoji
                    }), (0, n.jsx)("span", {
                        children: "CODE"
                    }), (0, n.jsx)("span", {
                        className: "font-extrabold bg-white text-[#3461FF] px-1.5 rounded",
                        children: l.h0.code
                    }), (0, n.jsxs)("span", {
                        children: ["FOR ", l.h0.discountLabel]
                    }), (0, n.jsx)("span", {
                        children: "\uD83D\uDD25"
                    }), (0, n.jsxs)("span", {
                        className: "font-bold",
                        children: ["ENDS IN ⏰ ", t]
                    })]
                });
                return (0, n.jsxs)("div", {
                    className: "jsx-4e538e0f27d1a7cc w-full bg-gradient-to-r from-[#3461FF] via-[#4F74FF] to-[#3461FF] text-white font-medium border-b-2 border-[#21253B] shadow-lg",
                    children: [(0, n.jsx)("div", {
                        className: "jsx-4e538e0f27d1a7cc sm:hidden overflow-hidden py-1.5",
                        children: (0, n.jsxs)("div", {
                            className: "jsx-4e538e0f27d1a7cc flex w-max items-center whitespace-nowrap animate-countdown-marquee",
                            children: [(0, n.jsx)(u, {
                                className: "jsx-4e538e0f27d1a7cc"
                            }), (0, n.jsx)(u, {
                                className: "jsx-4e538e0f27d1a7cc"
                            })]
                        })
                    }), (0, n.jsx)("div", {
                        className: "jsx-4e538e0f27d1a7cc hidden sm:block py-1.5 px-4 text-center",
                        children: (0, n.jsxs)("div", {
                            className: "jsx-4e538e0f27d1a7cc flex items-center justify-center gap-2 flex-wrap",
                            children: [(0, n.jsxs)("p", {
                                className: "jsx-4e538e0f27d1a7cc flex items-center justify-center flex-wrap gap-1 text-[13px]",
                                children: [(0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc animate-bounce inline-block",
                                    children: l.h0.emoji
                                }), (0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc",
                                    children: "CODE"
                                }), (0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc font-extrabold bg-white text-[#3461FF] px-1.5 rounded-md mx-1",
                                    children: l.h0.code
                                }), (0, n.jsxs)("span", {
                                    className: "jsx-4e538e0f27d1a7cc",
                                    children: ["FOR ", l.h0.discountLabel]
                                }), (0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc animate-bounce inline-block",
                                    children: "\uD83D\uDD25"
                                })]
                            }), (0, n.jsxs)("div", {
                                className: "jsx-4e538e0f27d1a7cc flex items-center gap-1 text-[13px] font-bold bg-black/20 px-2.5 py-0.5 rounded-full",
                                children: [(0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc",
                                    children: "ENDS IN ⏰"
                                }), (0, n.jsx)("span", {
                                    className: "jsx-4e538e0f27d1a7cc",
                                    children: t
                                })]
                            })]
                        })
                    }), (0, n.jsx)(s(), {
                        id: "4e538e0f27d1a7cc",
                        children: "@-webkit-keyframes countdown-marquee{from{-webkit-transform:translatex(0);transform:translatex(0)}to{-webkit-transform:translatex(-50%);transform:translatex(-50%)}}@-moz-keyframes countdown-marquee{from{-moz-transform:translatex(0);transform:translatex(0)}to{-moz-transform:translatex(-50%);transform:translatex(-50%)}}@-o-keyframes countdown-marquee{from{-o-transform:translatex(0);transform:translatex(0)}to{-o-transform:translatex(-50%);transform:translatex(-50%)}}@keyframes countdown-marquee{from{-webkit-transform:translatex(0);-moz-transform:translatex(0);-o-transform:translatex(0);transform:translatex(0)}to{-webkit-transform:translatex(-50%);-moz-transform:translatex(-50%);-o-transform:translatex(-50%);transform:translatex(-50%)}}.animate-countdown-marquee.jsx-4e538e0f27d1a7cc{-webkit-animation:countdown-marquee 12s linear infinite;-moz-animation:countdown-marquee 12s linear infinite;-o-animation:countdown-marquee 12s linear infinite;animation:countdown-marquee 12s linear infinite}"
                    })]
                })
            }
        },
        94871: function(e, t, r) {
            "use strict";
            r.d(t, {
                HideOnAppRoutes: function() {
                    return i
                }
            });
            var n = r(10131),
                a = r(67057);
            let s = ["/welcome", "/app-welcome", "/app-purchase"];

            function i(e) {
                let {
                    children: t
                } = e, r = (0, a.usePathname)();
                return s.some(e => null == r ? void 0 : r.startsWith(e)) ? null : (0, n.jsx)(n.Fragment, {
                    children: t
                })
            }
        },
        71384: function(e, t, r) {
            "use strict";
            var n = r(10131),
                a = r(55185),
                s = r(75775),
                i = r(67057),
                o = r(66961),
                l = r(59564),
                d = r(63833),
                c = r(69687),
                u = r(63855),
                f = r(43336);
            let x = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                h = () => {
                    try {
                        localStorage.setItem(f.sE, "1")
                    } catch (e) {}
                    window.dispatchEvent(new Event(f.Vu))
                };
            t.default = () => {
                let e = (0, i.usePathname)(),
                    [t, r] = (0, a.useState)(!1),
                    [m, p] = (0, a.useState)(""),
                    [g, b] = (0, a.useState)("form"),
                    [v, j] = (0, a.useState)(null),
                    [w, C] = (0, a.useState)(!1);
                if ((0, a.useEffect)(() => {
                        if ("dialog" !== f.h0.mode || new Date(f.h0.endsAt).getTime() <= Date.now()) return;
                        if ("1" === localStorage.getItem(f.sE)) {
                            window.dispatchEvent(new Event(f.Vu));
                            return
                        }
                        let e = setTimeout(() => r(!0), 4e3);
                        return () => clearTimeout(e)
                    }, []), "dialog" !== f.h0.mode || !(0, f.fr)(e)) return null;
                let y = async e => {
                        e.preventDefault();
                        let t = m.trim();
                        if (!x.test(t)) {
                            j("Enter a valid email address.");
                            return
                        }
                        j(null), b("loading");
                        try {
                            let [e] = await Promise.all([fetch("/api/promo/signup", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    email: t
                                })
                            }), new Promise(e => setTimeout(e, 1200))]);
                            if (!e.ok) {
                                let t = await e.json().catch(() => null);
                                throw Error((null == t ? void 0 : t.message) || "Something went wrong. Please try again.")
                            }
                            h(), b("revealed")
                        } catch (e) {
                            b("form"), j(e instanceof Error ? e.message : "Something went wrong. Please try again.")
                        }
                    },
                    N = async () => {
                        try {
                            await navigator.clipboard.writeText(f.h0.code), C(!0), setTimeout(() => C(!1), 2e3)
                        } catch (e) {}
                    };
                return (0, n.jsx)(u.Vq, {
                    open: t,
                    onOpenChange: e => {
                        e || h(), r(e)
                    },
                    children: (0, n.jsxs)(u.cZ, {
                        className: "max-w-md p-0 gap-0 overflow-hidden bg-none bg-card-bg",
                        children: [(0, n.jsxs)("div", {
                            className: "relative h-44 w-full overflow-hidden",
                            children: [(0, n.jsx)("div", {
                                className: "absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,97,255,0.4),transparent_70%)]"
                            }), (0, n.jsx)(s.default, {
                                src: "/hero.png",
                                alt: "PickFinder props board",
                                width: 1440,
                                height: 676,
                                sizes: "900px",
                                priority: !0,
                                className: "absolute left-1/2 top-[-90px] w-[900px] max-w-none -translate-x-1/2"
                            }), (0, n.jsx)("div", {
                                className: "absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card-bg to-transparent"
                            })]
                        }), (0, n.jsx)("div", {
                            className: "flex flex-col gap-4 p-6 pt-2",
                            children: "revealed" !== g ? (0, n.jsxs)(n.Fragment, {
                                children: [(0, n.jsxs)(u.fK, {
                                    children: [(0, n.jsxs)(u.$N, {
                                        className: "text-xl",
                                        children: ["Get ", f.h0.discountShort, " your first month"]
                                    }), (0, n.jsx)(u.Be, {
                                        children: "Enter your email and we'll reveal the active promo code, plus send you picks and offers from PickFinder."
                                    })]
                                }), (0, n.jsxs)("form", {
                                    onSubmit: y,
                                    className: "flex flex-col gap-3",
                                    children: [(0, n.jsx)("input", {
                                        type: "email",
                                        value: m,
                                        onChange: e => p(e.target.value),
                                        placeholder: "you@example.com",
                                        autoComplete: "email",
                                        disabled: "loading" === g,
                                        className: "h-11 w-full rounded-lg bg-input-bg border border-input-border px-3 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/60 disabled:opacity-60"
                                    }), v && (0, n.jsx)("p", {
                                        className: "text-sm text-red-400",
                                        children: v
                                    }), (0, n.jsx)(c.z, {
                                        type: "submit",
                                        variant: "blue",
                                        className: "h-11",
                                        disabled: "loading" === g,
                                        children: "loading" === g ? (0, n.jsxs)("span", {
                                            className: "flex items-center gap-2",
                                            children: [(0, n.jsx)(o.Z, {
                                                className: "h-4 w-4 animate-spin"
                                            }), "Unlocking your code..."]
                                        }) : "Reveal my code"
                                    }), (0, n.jsx)("p", {
                                        className: "text-xs text-muted-foreground text-center sm:text-left",
                                        children: "Unsubscribe anytime."
                                    })]
                                })]
                            }) : (0, n.jsxs)(n.Fragment, {
                                children: [(0, n.jsxs)(u.fK, {
                                    children: [(0, n.jsx)(u.$N, {
                                        className: "text-xl",
                                        children: "Your code is ready"
                                    }), (0, n.jsxs)(u.Be, {
                                        children: ["Use it at checkout for ", f.h0.discountShort, " your first month."]
                                    })]
                                }), (0, n.jsxs)("button", {
                                    type: "button",
                                    onClick: N,
                                    className: "group flex items-center justify-between rounded-xl border border-input-border bg-input-bg px-4 py-3 transition-colors hover:border-blue-500/60",
                                    children: [(0, n.jsx)("span", {
                                        className: "text-2xl font-extrabold tracking-widest text-primary",
                                        children: f.h0.code
                                    }), (0, n.jsxs)("span", {
                                        className: "flex items-center gap-1.5 text-sm text-blue-400",
                                        children: [w ? (0, n.jsx)(l.Z, {
                                            className: "h-4 w-4"
                                        }) : (0, n.jsx)(d.Z, {
                                            className: "h-4 w-4"
                                        }), w ? "Copied" : "Copy"]
                                    })]
                                }), (0, n.jsx)(c.z, {
                                    variant: "blue",
                                    className: "h-11",
                                    asChild: !0,
                                    children: (0, n.jsxs)("a", {
                                        href: "/pricing",
                                        children: ["Claim ", f.h0.discountShort]
                                    })
                                })]
                            })
                        })]
                    })
                })
            }
        },
        77941: function(e, t, r) {
            "use strict";
            r.d(t, {
                default: function() {
                    return o
                }
            });
            var n = r(10131),
                a = r(55185),
                s = r(69237),
                i = r(59160);

            function o(e) {
                var t;
                let {
                    children: r
                } = e, {
                    isWebViewApp: o
                } = (0, i.B)(), {
                    isLoaded: l,
                    user: d
                } = (0, s.aF)(), c = null == d ? void 0 : null === (t = d.publicMetadata) || void 0 === t ? void 0 : t.plan, [u, f] = (0, a.useState)(!1);
                (0, a.useEffect)(() => f(!0), []);
                let x = l && !!c && !["None", "Admin"].includes(c);
                return u && (o || x) ? null : (0, n.jsx)(n.Fragment, {
                    children: r
                })
            }
        },
        77252: function(e, t, r) {
            "use strict";
            var n = r(10131),
                a = r(55185),
                s = r(75775),
                i = r(56825),
                o = r(51465),
                l = r(41915),
                d = r(69948),
                c = r(69237),
                u = r(71599),
                f = r(91e3);
            let x = () => {
                    let {
                        isLoaded: e,
                        isSignedIn: t
                    } = (0, d.y)(), [r, n] = (0, a.useState)(!1);
                    return (0, a.useEffect)(() => n(!0), []), r && e && !!t
                },
                h = e => {
                    let {
                        children: t
                    } = e;
                    return x() ? (0, n.jsx)(n.Fragment, {
                        children: t
                    }) : null
                },
                m = e => {
                    let {
                        children: t
                    } = e;
                    return x() ? null : (0, n.jsx)(n.Fragment, {
                        children: t
                    })
                };
            t.default = e => {
                var t;
                let {
                    freemiumEnabled: r
                } = e, {
                    user: a
                } = (0, c.aF)(), d = null == a ? void 0 : null === (t = a.publicMetadata) || void 0 === t ? void 0 : t.plan;
                return (0, n.jsx)("div", {
                    className: "hide-in-pwa-shell relative z-50 flex items-center justify-center w-full",
                    children: (0, n.jsxs)("div", {
                        className: "flex justify-between items-center bg-[#060a1c] border border-[#21253B] rounded-[36px] max-w-5xl w-full py-1 px-3 my-2 mx-4 lg:mx-32",
                        children: [(0, n.jsx)(l.default, {
                            href: "/",
                            children: (0, n.jsx)(s.default, {
                                src: "/pickfinder-logo.png",
                                width: 36,
                                height: 36,
                                alt: "Pickfinder logo"
                            })
                        }), (0, n.jsxs)("div", {
                            className: "hidden lg:flex gap-[24px] text-[14px] text-[#AFB2C0]",
                            children: [(0, n.jsx)(l.default, {
                                href: "/#sports",
                                children: "Sports"
                            }), (0, n.jsx)(l.default, {
                                href: "/pricing",
                                children: "Pricing"
                            }), (0, n.jsx)(l.default, {
                                href: "/#testimonials",
                                children: "Success"
                            }), (0, n.jsx)(l.default, {
                                href: "https://discord.gg/pickfinder",
                                target: "_blank",
                                children: "Discord"
                            }), (0, n.jsxs)(l.default, {
                                href: "/promos",
                                className: "flex shrink-0 items-center gap-1.5 whitespace-nowrap text-emerald-400 font-medium animate-pulse hover:animate-none",
                                children: [(0, n.jsx)(u.Z, {
                                    className: "h-4 w-4"
                                }), "$2K BONUS"]
                            }), (0, n.jsx)("div", {
                                className: "bg-[#21253B] w-[1px]"
                            }), (0, n.jsxs)(l.default, {
                                href: "/contact",
                                className: "flex items-center justify-center gap-[6px]",
                                children: [(0, n.jsxs)("svg", {
                                    width: "18",
                                    height: "19",
                                    viewBox: "0 0 18 19",
                                    fill: "none",
                                    xmlns: "http://www.w3.org/2000/svg",
                                    children: [(0, n.jsx)("rect", {
                                        x: "3",
                                        y: "5",
                                        width: "12",
                                        height: "9",
                                        fill: "#6F7280",
                                        fillOpacity: "0.4"
                                    }), (0, n.jsx)("path", {
                                        fillRule: "evenodd",
                                        clipRule: "evenodd",
                                        d: "M5.81903 3.5H12.181C12.7847 3.49999 13.283 3.49999 13.6889 3.53314C14.1104 3.56759 14.4979 3.64151 14.862 3.82698C15.4264 4.1146 15.8854 4.57354 16.173 5.13803C16.3585 5.50203 16.4324 5.88956 16.4668 6.31113C16.5 6.71702 16.5 7.21529 16.5 7.81901V11.181C16.5 11.7847 16.5 12.283 16.4668 12.6889C16.4324 13.1104 16.3585 13.4979 16.173 13.862C15.8854 14.4264 15.4264 14.8854 14.862 15.173C14.4979 15.3585 14.1104 15.4324 13.6889 15.4668C13.283 15.5 12.7847 15.5 12.181 15.5H5.81904C5.21531 15.5 4.71704 15.5 4.31113 15.4668C3.88956 15.4324 3.50203 15.3585 3.13803 15.173C2.57354 14.8854 2.1146 14.4264 1.82698 13.862C1.64151 13.4979 1.56759 13.1104 1.53314 12.6889C1.49999 12.283 1.49999 11.7847 1.5 11.181V7.81903C1.49999 7.2153 1.49999 6.71703 1.53314 6.31114C1.56759 5.88956 1.64151 5.50203 1.82698 5.13803C2.1146 4.57354 2.57354 4.1146 3.13803 3.82698C3.50203 3.64151 3.88956 3.56759 4.31113 3.53314C4.71703 3.49999 5.2153 3.49999 5.81903 3.5ZM4.43328 5.02816C4.10447 5.05503 3.93632 5.10373 3.81902 5.16349C3.53678 5.3073 3.3073 5.53678 3.16349 5.81902C3.10373 5.93632 3.05503 6.10447 3.02816 6.43328C3.00059 6.77085 3 7.20757 3 7.85V11.15C3 11.7924 3.00059 12.2292 3.02816 12.5668C3.05503 12.8956 3.10373 13.0637 3.16349 13.181C3.3073 13.4632 3.53678 13.6927 3.81902 13.8365C3.93632 13.8963 4.10447 13.945 4.43328 13.9718C4.77085 13.9994 5.20757 14 5.85 14H12.15C12.7925 14 13.2292 13.9994 13.5668 13.9718C13.8956 13.945 14.0637 13.8963 14.181 13.8365C14.4632 13.6927 14.6927 13.4632 14.8365 13.181C14.8963 13.0637 14.945 12.8956 14.9718 12.5668C14.9994 12.2292 15 11.7924 15 11.15V7.85C15 7.20757 14.9994 6.77085 14.9718 6.43328C14.945 6.10447 14.8963 5.93632 14.8365 5.81902C14.6927 5.53678 14.4632 5.3073 14.181 5.16349C14.0637 5.10373 13.8956 5.05503 13.5668 5.02816C13.2292 5.00059 12.7925 5 12.15 5H5.85C5.20757 5 4.77085 5.00059 4.43328 5.02816Z",
                                        fill: "#6F7280"
                                    }), (0, n.jsx)("path", {
                                        fillRule: "evenodd",
                                        clipRule: "evenodd",
                                        d: "M4.63161 6.8258C4.86593 6.48424 5.33277 6.39729 5.67434 6.63161L8.5758 8.62205C8.83148 8.7974 9.16868 8.7974 9.42435 8.62205L12.3258 6.63161C12.6674 6.39729 13.1342 6.48424 13.3685 6.8258C13.6028 7.16738 13.5159 7.63422 13.1744 7.86854L10.2729 9.85895C9.50588 10.3851 8.49428 10.3851 7.72725 9.85895L4.82581 7.86854C4.48424 7.63422 4.39729 7.16738 4.63161 6.8258Z",
                                        fill: "#6F7280"
                                    })]
                                }), "Contact"]
                            })]
                        }), (0, n.jsxs)("div", {
                            className: "flex gap-1",
                            children: [(0, n.jsxs)(l.default, {
                                href: "/promos",
                                className: "lg:hidden mr-2 flex shrink-0 items-center justify-center gap-1 whitespace-nowrap animate-pulse hover:animate-none text-emerald-400",
                                children: [(0, n.jsx)(u.Z, {
                                    className: "h-4 w-4"
                                }), (0, n.jsx)("span", {
                                    children: "$2K"
                                })]
                            }), (0, n.jsxs)(m, {
                                children: [r && (0, n.jsx)("div", {
                                    className: "hidden sm:block border-[4px] border-[#0E1429] rounded-3xl",
                                    children: (0, n.jsx)(l.default, {
                                        href: "/sign-in",
                                        children: (0, n.jsx)(i.z, {
                                            variant: "grey",
                                            children: "Sign in"
                                        })
                                    })
                                }), (0, n.jsx)("div", {
                                    className: "border-[4px] border-[#3461FF33] rounded-3xl",
                                    children: (0, n.jsx)(l.default, {
                                        href: r ? "/props" : "/sign-in",
                                        children: (0, n.jsxs)(i.z, {
                                            variant: "blue",
                                            children: [r ? "Try for free" : "Sign in", (0, n.jsx)("svg", {
                                                width: "16",
                                                height: "16",
                                                viewBox: "0 0 16 16",
                                                fill: "none",
                                                xmlns: "http://www.w3.org/2000/svg",
                                                children: (0, n.jsx)("path", {
                                                    d: "M2 7.99987H14M14 7.99987L9.33333 3.33325M14 7.99987L9.33333 12.6665",
                                                    stroke: "white",
                                                    strokeWidth: "1.5",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round"
                                                })
                                            })]
                                        })
                                    })
                                })]
                            }), (0, n.jsx)(h, {
                                children: d && "None" !== d ? (0, n.jsx)("div", {
                                    className: "border-[4px] border-[#3461FF33] rounded-3xl",
                                    children: (0, n.jsx)(l.default, {
                                        href: "/props",
                                        children: (0, n.jsxs)(i.z, {
                                            variant: "blue",
                                            children: ["Dashboard", (0, n.jsx)("svg", {
                                                width: "16",
                                                height: "16",
                                                viewBox: "0 0 16 16",
                                                fill: "none",
                                                xmlns: "http://www.w3.org/2000/svg",
                                                children: (0, n.jsx)("path", {
                                                    d: "M2 7.99987H14M14 7.99987L9.33333 3.33325M14 7.99987L9.33333 12.6665",
                                                    stroke: "white",
                                                    strokeWidth: "1.5",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round"
                                                })
                                            })]
                                        })
                                    })
                                }) : (0, n.jsxs)("div", {
                                    className: "flex items-center gap-1",
                                    children: [(0, n.jsx)("div", {
                                        className: "border-[4px] border-[#3461FF33] rounded-3xl",
                                        children: (0, n.jsx)(l.default, {
                                            href: r ? "/props" : "/#pricing",
                                            children: (0, n.jsxs)(i.z, {
                                                variant: "blue",
                                                children: [r ? "Try for free" : "Purchase", r ? (0, n.jsx)("svg", {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "none",
                                                    xmlns: "http://www.w3.org/2000/svg",
                                                    children: (0, n.jsx)("path", {
                                                        d: "M2 7.99987H14M14 7.99987L9.33333 3.33325M14 7.99987L9.33333 12.6665",
                                                        stroke: "white",
                                                        strokeWidth: "1.5",
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round"
                                                    })
                                                }) : (0, n.jsxs)("svg", {
                                                    width: "24",
                                                    height: "24",
                                                    viewBox: "0 0 21 20",
                                                    fill: "none",
                                                    xmlns: "http://www.w3.org/2000/svg",
                                                    children: [(0, n.jsx)("path", {
                                                        fillRule: "evenodd",
                                                        clipRule: "evenodd",
                                                        d: "M19.4226 15.2437C19.748 15.5692 19.748 16.0968 19.4226 16.4222L17.7559 18.0889C17.4305 18.4143 16.9028 18.4143 16.5774 18.0889C16.252 17.7635 16.252 17.2358 16.5774 16.9104L16.8215 16.6663H13.8333C13.3731 16.6663 13 16.2932 13 15.833C13 15.3727 13.3731 14.9997 13.8333 14.9997H16.8215L16.5774 14.7556C16.252 14.4302 16.252 13.9025 16.5774 13.5771C16.9028 13.2517 17.4305 13.2517 17.7559 13.5771L19.4226 15.2437Z",
                                                        fill: "white"
                                                    }), (0, n.jsx)("rect", {
                                                        x: "3",
                                                        y: "5",
                                                        width: "15",
                                                        height: "3",
                                                        fill: "white",
                                                        fillOpacity: "0.10"
                                                    }), (0, n.jsx)("path", {
                                                        d: "M5.5 12.5003C5.5 12.0401 5.8731 11.667 6.33333 11.667H9.66667C10.1269 11.667 10.5 12.0401 10.5 12.5003C10.5 12.9606 10.1269 13.3337 9.66667 13.3337H6.33333C5.8731 13.3337 5.5 12.9606 5.5 12.5003Z",
                                                        fill: "white"
                                                    }), (0, n.jsx)("path", {
                                                        d: "M2.1665 7.5H18.8332V9.16667H2.1665V7.5Z",
                                                        fill: "white"
                                                    }), (0, n.jsx)("path", {
                                                        fillRule: "evenodd",
                                                        clipRule: "evenodd",
                                                        d: "M6.96591 3.33301H14.0347C14.7056 3.333 15.2592 3.33299 15.7102 3.36983C16.1786 3.40811 16.6092 3.49024 17.0137 3.69632C17.6408 4.0159 18.1507 4.52583 18.4703 5.15304C18.6764 5.55748 18.7586 5.98807 18.7968 6.45648C18.8337 6.90747 18.8337 7.46111 18.8337 8.13191V10.833C18.8337 11.2933 18.4606 11.6663 18.0003 11.6663C17.5401 11.6663 17.167 11.2933 17.167 10.833V8.16634C17.167 7.45253 17.1663 6.96728 17.1357 6.59221C17.1058 6.22686 17.0517 6.04002 16.9853 5.90969C16.8256 5.59609 16.5706 5.34112 16.257 5.18133C16.1267 5.11492 15.9398 5.06082 15.5745 5.03097C15.1994 5.00032 14.7142 4.99967 14.0003 4.99967H7.00033C6.28651 4.99967 5.80127 5.00032 5.42619 5.03097C5.06084 5.06082 4.87401 5.11492 4.74368 5.18133C4.43008 5.34112 4.1751 5.59609 4.01532 5.90969C3.94891 6.04002 3.8948 6.22686 3.86495 6.59221C3.83431 6.96728 3.83366 7.45253 3.83366 8.16634V11.833C3.83366 12.5468 3.83431 13.0321 3.86495 13.4072C3.8948 13.7725 3.94891 13.9593 4.01532 14.0897C4.1751 14.4033 4.43008 14.6583 4.74368 14.818C4.87401 14.8844 5.06084 14.9385 5.42619 14.9683C5.80127 14.999 6.28651 14.9997 7.00033 14.9997H10.5003C10.9606 14.9997 11.3337 15.3728 11.3337 15.833C11.3337 16.2933 10.9606 16.6663 10.5003 16.6663H6.96593C6.29511 16.6663 5.74148 16.6663 5.29047 16.6295C4.82206 16.5913 4.39147 16.5091 3.98703 16.303C3.35982 15.9834 2.84988 15.4735 2.5303 14.8463C2.32423 14.4418 2.24209 14.0113 2.20382 13.5428C2.16698 13.0918 2.16698 12.5383 2.16699 11.8674V8.13193C2.16698 7.46112 2.16698 6.90748 2.20382 6.45649C2.24209 5.98807 2.32423 5.55748 2.5303 5.15304C2.84988 4.52583 3.35982 4.0159 3.98703 3.69632C4.39147 3.49024 4.82206 3.40811 5.29047 3.36983C5.74147 3.33299 6.2951 3.333 6.96591 3.33301Z",
                                                        fill: "white"
                                                    })]
                                                })]
                                            })
                                        })
                                    }), (0, n.jsx)(c.AM, {
                                        children: (0, n.jsx)("div", {
                                            className: "grid cursor-pointer place-items-center text-primary hover:text-gray-300",
                                            children: (0, n.jsx)(f.Z, {
                                                size: 24
                                            })
                                        })
                                    })]
                                })
                            }), (0, n.jsxs)(o.J2, {
                                modal: !1,
                                children: [(0, n.jsx)(o.xo, {
                                    asChild: !0,
                                    children: (0, n.jsx)("div", {
                                        className: "block md:hidden border-[4px] border-[#0E1429] rounded-3xl",
                                        children: (0, n.jsx)(i.z, {
                                            variant: "grey",
                                            className: "p-3",
                                            children: (0, n.jsx)("svg", {
                                                width: "16",
                                                height: "16",
                                                viewBox: "0 0 16 16",
                                                fill: "none",
                                                xmlns: "http://www.w3.org/2000/svg",
                                                children: (0, n.jsx)("path", {
                                                    d: "M2 4H14M2 8H14M2 12H14",
                                                    stroke: "white",
                                                    strokeWidth: "1.5",
                                                    strokeLinecap: "round"
                                                })
                                            })
                                        })
                                    })
                                }), (0, n.jsxs)(o.yk, {
                                    sideOffset: 8,
                                    className: "flex lg:hidden flex-col items-center w-28 bg-[#060a1c] border-[#21253B] text-foreground rounded-2xl gap-3 mr-4 md:mr-4 text-[#AFB2C0] text-[14px]",
                                    children: [(0, n.jsx)(l.default, {
                                        href: "/#sports",
                                        children: "Sports"
                                    }), (0, n.jsx)("div", {
                                        className: "bg-[#21253B] w-full h-[1px]"
                                    }), (0, n.jsx)(l.default, {
                                        href: "/pricing",
                                        children: "Pricing"
                                    }), (0, n.jsx)("div", {
                                        className: "bg-[#21253B] w-full h-[1px]"
                                    }), (0, n.jsx)(l.default, {
                                        href: "/#testimonials",
                                        children: "Success"
                                    }), (0, n.jsx)("div", {
                                        className: "bg-[#21253B] w-full h-[1px]"
                                    }), (0, n.jsx)(l.default, {
                                        href: "https://discord.gg/pickfinder",
                                        target: "_blank",
                                        children: "Discord"
                                    }), (0, n.jsx)("div", {
                                        className: "bg-[#21253B] w-full h-[1px]"
                                    }), (0, n.jsx)(l.default, {
                                        href: "/contact",
                                        children: "Contact"
                                    }), (0, n.jsx)("div", {
                                        className: "bg-[#21253B] w-full h-[1px]"
                                    }), (0, n.jsx)(l.default, {
                                        href: "/#faq",
                                        children: "FAQ"
                                    }), r && (0, n.jsxs)(m, {
                                        children: [(0, n.jsx)("div", {
                                            className: "bg-[#21253B] w-full h-[1px]"
                                        }), (0, n.jsx)(l.default, {
                                            href: "/sign-in",
                                            children: "Sign in"
                                        })]
                                    })]
                                })]
                            })]
                        })]
                    })
                })
            }
        },
        56825: function(e, t, r) {
            "use strict";
            r.d(t, {
                z: function() {
                    return d
                }
            });
            var n = r(10131),
                a = r(55185),
                s = r(33658),
                i = r(60656),
                o = r(87786);
            let l = (0, i.j)("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300", {
                    variants: {
                        variant: {
                            default: "bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90",
                            destructive: "bg-red-500 text-neutral-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/90",
                            outline: "border border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
                            secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80",
                            ghost: "hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
                            link: "text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50",
                            blue: "bg-gradient-to-b from-[#567BFF] to-[#3461FF] rounded-3xl transition-all hover:brightness-90",
                            grey: "bg-gradient-to-b from-[#262A3D] to-[#1C2033] rounded-3xl text-[#AFB2C0] transition-all hover:brightness-90",
                            dark: "bg-[#0E1429] border border-[#3461FF] rounded-3xl text-[#AFB2C0] transition-all hover:brightness-90"
                        },
                        size: {
                            default: "h-10 px-4 py-2",
                            sm: "h-9 rounded-md px-3",
                            lg: "h-11 rounded-md px-8",
                            icon: "h-10 w-10"
                        }
                    },
                    defaultVariants: {
                        variant: "default",
                        size: "default"
                    }
                }),
                d = a.forwardRef((e, t) => {
                    let {
                        className: r,
                        variant: a,
                        size: i,
                        asChild: d = !1,
                        ...c
                    } = e, u = d ? s.g7 : "button";
                    return (0, n.jsx)(u, {
                        className: (0, o.cn)(l({
                            variant: a,
                            size: i,
                            className: r
                        })),
                        ref: t,
                        ...c
                    })
                });
            d.displayName = "Button"
        },
        69687: function(e, t, r) {
            "use strict";
            r.d(t, {
                d: function() {
                    return l
                },
                z: function() {
                    return d
                }
            });
            var n = r(10131),
                a = r(55185),
                s = r(33658),
                i = r(60656),
                o = r(58685);
            let l = (0, i.j)("inline-flex items-center transition-all  justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", {
                    variants: {
                        variant: {
                            gradient: "text-primary border border-input bg-gradient-to-b w-full from-gray-800 to-transparent hover:brightness-125 hover:bg-inherit",
                            default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                            destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                            outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                            secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                            blue: "text-primary border border-input bg-gradient-to-t w-full from-blue-800 to-blue-600 hover:brightness-125 hover:bg-inherit",
                            ghost: "hover:bg-accent hover:text-accent-foreground",
                            link: "text-primary underline-offset-4 hover:underline",
                            underline: "rounded-none !h-auto !px-0 !py-1 inline-flex w-min items-start text-left border-b-2 border-transparent hover:brightness-75 justify-center py-1 font-medium transition-all disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm text-slate-400 data-[state=active]:border-white data-[state=active]:text-slate-100"
                        },
                        size: {
                            default: "h-9 px-4 py-2",
                            sm: "h-8 rounded-md px-3 text-xs",
                            lg: "h-10 rounded-md px-8",
                            icon: "h-9 w-9"
                        }
                    },
                    defaultVariants: {
                        variant: "default",
                        size: "default"
                    }
                }),
                d = a.forwardRef((e, t) => {
                    let {
                        className: r,
                        variant: a,
                        size: i,
                        asChild: d = !1,
                        ...c
                    } = e, u = d ? s.g7 : "button";
                    return (0, n.jsx)(u, {
                        className: (0, o.cn)(l({
                            variant: a,
                            size: i,
                            className: r
                        })),
                        ref: t,
                        ...c
                    })
                });
            d.displayName = "Button"
        },
        63855: function(e, t, r) {
            "use strict";
            r.d(t, {
                $N: function() {
                    return p
                },
                Be: function() {
                    return g
                },
                GG: function() {
                    return u
                },
                Vq: function() {
                    return l
                },
                cN: function() {
                    return m
                },
                cZ: function() {
                    return x
                },
                fK: function() {
                    return h
                },
                hg: function() {
                    return d
                }
            });
            var n = r(10131),
                a = r(55185),
                s = r(31468),
                i = r(40122),
                o = r(58685);
            let l = s.fC,
                d = s.xz,
                c = s.h_,
                u = s.x8,
                f = a.forwardRef((e, t) => {
                    let {
                        className: r,
                        ...a
                    } = e;
                    return (0, n.jsx)(s.aV, {
                        ref: t,
                        className: (0, o.cn)("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", r),
                        ...a
                    })
                });
            f.displayName = s.aV.displayName;
            let x = a.forwardRef((e, t) => {
                let {
                    className: r,
                    children: a,
                    ...l
                } = e;
                return (0, n.jsxs)(c, {
                    children: [(0, n.jsx)(f, {}), (0, n.jsxs)(s.VY, {
                        ref: t,
                        className: (0, o.cn)("fixed text-primary left-[50%] top-[50%] z-50 grid w-[90%] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-gradient-to-br from-input-bg/95 to-input-bg/60 backdrop-blur-sm p-6 shadow-2xl rounded-2xl border-2 border-blue-500/20", "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]", r),
                        ...l,
                        children: [a, (0, n.jsxs)(s.x8, {
                            className: "absolute right-4 top-4 rounded-lg opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-white/5 p-1 focus:outline-none focus-visible:outline-none disabled:pointer-events-none",
                            children: [!l.hideClose && (0, n.jsx)(i.Z, {
                                className: "h-5 w-5 text-muted-foreground hover:text-foreground"
                            }), (0, n.jsx)("span", {
                                className: "sr-only",
                                children: "Close"
                            })]
                        })]
                    })]
                })
            });
            x.displayName = s.VY.displayName;
            let h = e => {
                let {
                    className: t,
                    ...r
                } = e;
                return (0, n.jsx)("div", {
                    className: (0, o.cn)("flex flex-col space-y-2 sm:text-left text-center", t),
                    ...r
                })
            };
            h.displayName = "DialogHeader";
            let m = e => {
                let {
                    className: t,
                    ...r
                } = e;
                return (0, n.jsx)("div", {
                    className: (0, o.cn)("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", t),
                    ...r
                })
            };
            m.displayName = "DialogFooter";
            let p = a.forwardRef((e, t) => {
                let {
                    className: r,
                    ...a
                } = e;
                return (0, n.jsx)(s.Dx, {
                    ref: t,
                    className: (0, o.cn)("text-lg font-semibold leading-none tracking-tight text-primary", r),
                    ...a
                })
            });
            p.displayName = s.Dx.displayName;
            let g = a.forwardRef((e, t) => {
                let {
                    className: r,
                    ...a
                } = e;
                return (0, n.jsx)(s.dk, {
                    ref: t,
                    className: (0, o.cn)("text-sm text-muted-foreground", r),
                    ...a
                })
            });
            g.displayName = s.dk.displayName
        },
        51465: function(e, t, r) {
            "use strict";
            r.d(t, {
                J2: function() {
                    return o
                },
                xo: function() {
                    return l
                },
                yk: function() {
                    return d
                }
            });
            var n = r(10131),
                a = r(55185),
                s = r(49940),
                i = r(60581);
            let o = s.fC,
                l = s.xz,
                d = a.forwardRef((e, t) => {
                    let {
                        className: r,
                        align: a = "center",
                        sideOffset: o = 4,
                        ...l
                    } = e;
                    return (0, n.jsx)(s.h_, {
                        children: (0, n.jsx)(s.VY, {
                            ref: t,
                            align: a,
                            sideOffset: o,
                            className: (0, i.cn)("text-primary animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 z-50 outline-none border-input relative rounded-3xl p-6 shadow-2xl border-2 max-w-sm w-full mx-4 bg-input-bg", r),
                            ...l
                        })
                    })
                });
            d.displayName = s.VY.displayName
        },
        59160: function(e, t, r) {
            "use strict";
            r.d(t, {
                B: function() {
                    return i
                },
                WebViewProvider: function() {
                    return o
                }
            });
            var n = r(10131),
                a = r(55185);
            let s = (0, a.createContext)(void 0),
                i = () => {
                    let e = (0, a.useContext)(s);
                    if (void 0 === e) throw Error("useWebView must be used within a WebViewProvider");
                    return e
                },
                o = e => {
                    let {
                        isWebViewApp: t,
                        children: r
                    } = e, [i, o] = (0, a.useState)(!1);
                    return (0, a.useEffect)(() => {
                        void 0 === t && o(navigator.userAgent.includes("PWAShell"))
                    }, [t]), (0, n.jsx)(s.Provider, {
                        value: {
                            isWebViewApp: null != t ? t : i
                        },
                        children: r
                    })
                }
        },
        43336: function(e, t, r) {
            "use strict";
            r.d(t, {
                Vu: function() {
                    return i
                },
                fr: function() {
                    return a
                },
                h0: function() {
                    return n
                },
                sE: function() {
                    return s
                }
            });
            let n = {
                    mode: "dialog",
                    code: "NFL",
                    discountLabel: "20% OFF",
                    discountShort: "20% off",
                    emoji: "\uD83C\uDFC8",
                    endsAt: "2026-09-15T03:00:00-04:00"
                },
                a = e => "/" === e || "/pricing" === e || "/blog" === e || !!(null == e ? void 0 : e.startsWith("/blog/")),
                s = "pf-promo-dialog-done:".concat(n.code),
                i = "pf-promo-dialog-done"
        },
        87786: function(e, t, r) {
            "use strict";
            r.d(t, {
                cn: function() {
                    return s
                }
            });
            var n = r(63210),
                a = r(86470);

            function s() {
                for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                return (0, a.m)((0, n.W)(t))
            }
        },
        60581: function(e, t, r) {
            "use strict";
            r.d(t, {
                cn: function() {
                    return s
                }
            });
            var n = r(63210),
                a = r(86470);

            function s() {
                for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                return (0, a.m)((0, n.W)(t))
            }
        },
        58685: function(e, t, r) {
            "use strict";
            r.d(t, {
                cn: function() {
                    return s
                },
                mL: function() {
                    return o
                }
            });
            var n = r(63210),
                a = r(86470);

            function s() {
                for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                return (0, a.m)((0, n.W)(t))
            }
            r(72044);
            let i = {
                round_of_128: "Round of 128",
                round_of_64: "Round of 64",
                round_of_32: "Round of 32",
                round_of_16: "Round of 16",
                quarterfinal: "Quarterfinals",
                semifinal: "Semifinals",
                qualification: "Qualification",
                qualification_round_1: "Qual Round 1",
                qualification_round_2: "Qual Round 2",
                qualification_round_3: "Qual Round 3",
                qualification_final: "Qual Final",
                final: "Final",
                hardcourt_outdoor: "Hardcourt Outdoor",
                hardcourt_indoor: "Hardcourt Indoor",
                red_clay: "Red Clay",
                red_clay_outdoor: "Red Clay Outdoor",
                red_clay_indoor: "Red Clay Indoor",
                grass: "Grass"
            };

            function o(e) {
                return i[e] || e.charAt(0).toUpperCase() + e.slice(1)
            }
        }
    },
    function(e) {
        e.O(0, [8819, 9479, 4640, 2468, 9596, 6699, 679, 7926, 1872, 5079, 5552, 1355, 1744], function() {
            return e(e.s = 39306)
        }), _N_E = e.O()
    }
]);