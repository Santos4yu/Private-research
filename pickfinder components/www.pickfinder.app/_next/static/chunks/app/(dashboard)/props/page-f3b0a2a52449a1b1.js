(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [4076], {
        94776: function(e, t, a) {
            Promise.resolve().then(a.bind(a, 26292)), Promise.resolve().then(a.bind(a, 86008)), Promise.resolve().then(a.bind(a, 58520)), Promise.resolve().then(a.bind(a, 74093))
        },
        86008: function(e, t, a) {
            "use strict";
            a.d(t, {
                UpdateDialog: function() {
                    return d
                }
            });
            var n = a(10131);
            a(75775);
            var i = a(28876),
                o = a(68886);
            a(69687), a(63855);
            var l = a(69237);
            a(97869), a(41732), a(59564), a(63833), a(86128);
            var s = a(55185);
            a(55904), a(37260), a(50555), a(47288), a(84860), a(54308);
            var r = a(54586);
            let u = "pro-video-guide-v1";

            function d() {
                let {
                    user: e
                } = (0, l.aF)(), {
                    openUserProfile: t
                } = (0, l.ll)(), {
                    openProTrial: a,
                    openProUpgrade: d
                } = (0, o.An)(), {
                    state: v
                } = (0, o.sx)(), [f, h] = (0, s.useState)(!1), [c, p] = (0, s.useState)(!1);
                (0, s.useRef)(!1), (0, s.useEffect)(() => {
                    var t, a;
                    e && (0, i.nt)(null === (t = e.publicMetadata) || void 0 === t ? void 0 : t.plan) && (null == e ? void 0 : null === (a = e.unsafeMetadata) || void 0 === a ? void 0 : a.lastSeenUpdateId) !== u && h(!0)
                }, [e, v.hasPro, v.isTrialEligible, a, d]);
                let b = async t => {
                    t || (h(!1), await (null == e ? void 0 : e.update({
                        unsafeMetadata: { ...null == e ? void 0 : e.unsafeMetadata,
                            lastSeenUpdateId: u
                        }
                    })))
                };
                return (0, n.jsx)(r.W, {
                    open: f,
                    onOpenChange: b,
                    title: "New: The full PickFinder Pro guide",
                    description: "We just released a ~40 minute walkthrough of Arbitrage, Middles and EV+ — how each Pro tool works and how to use them to find profitable bets."
                })
            }
        }
    },
    function(e) {
        e.O(0, [9732, 5308, 6717, 1069, 6582, 792, 748, 4885, 723, 6825, 9679, 9404, 5331, 4242, 8819, 9479, 4640, 2468, 9596, 6699, 679, 3209, 2261, 7926, 1872, 6741, 1478, 9819, 1163, 1469, 3757, 6381, 3471, 4860, 1592, 8933, 4358, 4174, 4375, 4676, 6292, 5552, 1355, 1744], function() {
            return e(e.s = 94776)
        }), _N_E = e.O()
    }
]);