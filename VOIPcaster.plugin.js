/**
 * @name VOIP-Caster
 * @version 4.2.0
 * @author ideology
 * @authorLink https://github.com/ldeology
 * @description VOIP-Caster fixes the social contract of voice chat by assigning the intern to announce every mute, deafen, join, and leave so you can stop performing to an empty room. "just look at your 2nd monitor" -probably someone
 * @source https://github.com/ldeology/VOIP-Caster/blob/main/VOIPcaster.plugin.js
 * @updateUrl https://raw.githubusercontent.com/ldeology/VOIP-Caster/main/VOIPcaster.plugin.js
 */

const DEFAULT_CONFIG = {
    volume: 1,
    rate: 1,
    pitch: 1,
    voice: "",
    cooldown: 2,
    announceMute: true,
    announceUnmute: true,
    announceDeafen: true,
    announceUndeafen: true,
    announceJoin: true,
    announceLeave: true,
    announceScreenshareStart: true,
    announceScreenshareStop: false,
    announceSelfJoin: false,
    announceSelfLeave: false,
    announceServerMute: true,
    announceServerDeafen: true,
    muteText: "{name} muted",
    unmuteText: "{name} unmuted",
    deafenText: "{name} deafened",
    undeafenText: "{name} undeafened",
    joinText: "{name} joined",
    leaveText: "{name} left",
    screenshareStartText: "{name} is sharing their screen",
    screenshareStopText: "{name} stopped sharing",
    selfJoinText: "you joined the channel",
    selfLeaveText: "you left the channel",
    serverMuteText: "{name} was muted by an admin",
    serverDeafenText: "{name} was deafened by an admin",
    configured: false
};

module.exports = class VOIPCaster {
    start() {
        this.voiceStates  = {};
        this.currentUserId = null;
        this.interval     = null;
        this._cooldowns   = {};
        this._prevSelfChannelId = null;

        this.config = this._loadConfig();

        if (!this.config.configured) {
            this._showSetupModal();
        }

        try {
            this.UserStore            = BdApi.Webpack.getStore("UserStore");
            this.VoiceStateStore      = BdApi.Webpack.getStore("VoiceStateStore");
            this.SelectedChannelStore = BdApi.Webpack.getStore("SelectedChannelStore");

            if (!this.UserStore || !this.VoiceStateStore || !this.SelectedChannelStore)
                throw new Error("One or more stores could not be found.");

            const currentUser = this.UserStore.getCurrentUser();
            if (!currentUser) throw new Error("Could not get current user.");
            this.currentUserId = currentUser.id;

            this._seedInitialState();
            this.interval = setInterval(() => this.checkStates(), 500);
        } catch (e) {
            BdApi.UI.showToast(`VOIP-Caster: Failed to start — ${e.message}`, { type: "error" });
        }
    }

    stop() {
        clearInterval(this.interval);
        this.interval    = null;
        this.voiceStates = {};
        this._cooldowns  = {};
        speechSynthesis.cancel();
    }

    getSettingsPanel() {
        const btn = document.createElement("button");
        btn.textContent = "Open Configuration";
        Object.assign(btn.style, {
            marginTop: "16px",
            padding: "10px 22px",
            background: "linear-gradient(135deg, #5865f2, #7c3aed)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontFamily: "'Syne', sans-serif",
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "0.3px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        });
        btn.onclick = () => this._showSetupModal();
        return btn;
    }

    // ─ Config ─

    _loadConfig() {
        const saved = BdApi.Data.load("VOIP-Caster", "config");
        return Object.assign({}, DEFAULT_CONFIG, saved || {});
    }

    _saveConfig() {
        BdApi.Data.save("VOIP-Caster", "config", this.config);
    }

    // ─ Cooldown ─

    _canSpeak(userId, event) {
        const now    = Date.now();
        const coolMs = (this.config.cooldown || 2) * 1000;
        if (!this._cooldowns[userId]) this._cooldowns[userId] = {};
        const last = this._cooldowns[userId][event] || 0;
        if (now - last < coolMs) return false;
        this._cooldowns[userId][event] = now;
        return true;
    }

    // ─ Phrase validation ─

    _validatePhrase(text) {
        return text.includes("{name}");
    }

    // ─ Modal ─

    _showSetupModal() {
        document.getElementById("va-setup-modal")?.remove();
        const voices = speechSynthesis.getVoices();

        const modal = document.createElement("div");
        modal.id = "va-setup-modal";
        modal.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
                #va-setup-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0, 0, 0, 0.29);backdrop-filter:blur(6px);font-family:'Syne',sans-serif;animation:va-fade-in 0.2s ease}
                @keyframes va-fade-in{from{opacity:0}to{opacity:1}}
                @keyframes va-slide-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

                #va-box{
                    background:#0f0f13;
                    border:1px solid #2a2a38;
                    border-radius:16px;
                    width:980px;
                    max-width:96vw;
                    max-height:92vh;
                    display:flex;
                    flex-direction:column;
                    box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04);
                    animation:va-slide-up 0.25s ease;
                    overflow:hidden;
                }

                /* Top bar */
                .va-topbar{
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    padding:24px 28px 20px;
                    border-bottom:1px solid #1e1e2a;
                    flex-shrink:0;
                }
                .va-title{font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px}
                .va-subtitle{font-size:11px;color:#444;font-family:'DM Mono',monospace;margin-top:2px;letter-spacing:0.5px}
                .va-badge{background:linear-gradient(135deg,#5865f2,#7c3aed);color:#fff;font-size:9px;font-weight:700;padding:6px 10px;border-radius:12px;letter-spacing:1px;text-transform:uppercase;font-family:'DM Mono',monospace}

                /* Two column body */
                .va-body{
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:0;
                    overflow:hidden;
                    flex:1;
                    min-height:0;
                }

                .va-col{
                    padding:20px 24px;
                    overflow-y:auto;
                    scrollbar-width:thin;
                    scrollbar-color:#2a2a38 transparent;
                }
                .va-col::-webkit-scrollbar{width:4px}
                .va-col::-webkit-scrollbar-track{background:transparent}
                .va-col::-webkit-scrollbar-thumb{background:#2a2a38;border-radius:4px}
                .va-col-left{border-right:1px solid #1e1e2a;overflow-x:hidden}

                .va-section{margin-bottom:24px}
                .va-section:last-child{margin-bottom:0}
                .va-section-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5865f2;font-family:'DM Mono',monospace;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1e1e2a}

                /* Audio rows */
                .va-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;min-width:0}
                .va-row-label{font-size:12px;color:#ccc;font-weight:600;flex-shrink:0;width:72px}
                .va-slider-wrap{display:flex;align-items:center;gap:8px;flex:1}
                .va-slider{-webkit-appearance:none;flex:1;height:3px;background:#2a2a38;border-radius:2px;outline:none;cursor:pointer}
                .va-slider::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;background:#5865f2;border-radius:50%;cursor:pointer;box-shadow:0 0 0 3px rgba(88,101,242,0.2)}
                .va-slider::-webkit-slider-thumb:hover{background:#7c8df8}
                .va-val{font-family:'DM Mono',monospace;font-size:11px;color:#5865f2;min-width:32px;text-align:right}
                .va-select{flex:1;background:#1a1a24;border:1px solid #2a2a38;color:#ccc;border-radius:7px;padding:6px 10px;font-size:12px;font-family:'DM Mono',monospace;outline:none;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .va-select:focus{border-color:#5865f2}
                .va-num{width:56px;background:#1a1a24;border:1px solid #2a2a38;color:#ccc;border-radius:7px;padding:6px 10px;font-size:12px;font-family:'DM Mono',monospace;outline:none;text-align:center}
                .va-num:focus{border-color:#5865f2}

                /* Toggles */
                .va-toggle-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
                .va-toggle{display:flex;align-items:center;gap:8px;background:#1a1a24;border:1px solid #2a2a38;border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.15s,background 0.15s;user-select:none}
                .va-toggle.active{border-color:#5865f2;background:rgba(88,101,242,0.08)}
                .va-toggle-dot{width:7px;height:7px;border-radius:50%;background:#2a2a38;flex-shrink:0;transition:background 0.15s}
                .va-toggle.active .va-toggle-dot{background:#5865f2}
                .va-toggle-text{font-size:11px;color:#666;font-weight:600;transition:color 0.15s;line-height:1.2}
                .va-toggle.active .va-toggle-text{color:#ccc}
                .va-toggle-full{grid-column:1/-1}

                /* Phrases */
                .va-phrase-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px}
                .va-phrase-label{font-size:11px;color:#666;font-weight:600;flex-shrink:0;width:88px;padding-top:7px;font-family:'DM Mono',monospace}
                .va-input-wrap{flex:1;display:flex;flex-direction:column;gap:2px}
                .va-input{width:100%;background:#1a1a24;border:1px solid #2a2a38;color:#ccc;border-radius:7px;padding:6px 9px;font-size:12px;font-family:'DM Mono',monospace;outline:none;transition:border-color 0.15s;box-sizing:border-box}
                .va-input:focus{border-color:#5865f2}
                .va-input.error{border-color:#ed4245!important}
                .va-err{font-size:10px;color:#ed4245;font-family:'DM Mono',monospace;display:none}
                .va-err.show{display:block}
                .va-preview-btn{background:#1a1a24;border:1px solid #2a2a38;color:#555;font-family:'DM Mono',monospace;font-size:11px;padding:5px 8px;border-radius:6px;cursor:pointer;flex-shrink:0;transition:border-color 0.15s,color 0.15s;margin-top:1px}
                .va-preview-btn:hover{border-color:#5865f2;color:#5865f2}

                .va-hint{font-size:10px;color:#444;font-family:'DM Mono',monospace;margin-bottom:10px}
                .va-hint span{color:#5865f2;background:rgba(88,101,242,0.12);padding:1px 5px;border-radius:4px}
                .va-note{font-size:10px;color:#444;font-family:'DM Mono',monospace;background:#1a1a24;border:1px solid #1e1e2a;border-radius:6px;padding:7px 9px;margin-bottom:10px;line-height:1.5}

                /* Divider between phrase groups */
                .va-divider{height:1px;background:#1e1e2a;margin:14px 0}

                /* Footer */
                .va-footer{
                    display:flex;
                    gap:10px;
                    padding:12px 24px;
                    border-top:1px solid #1e1e2a;
                    flex-shrink:0;
                    justify-content:space-between;
                }
                .va-btn{flex:1;padding:10px;border-radius:9px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:opacity 0.15s,transform 0.1s;letter-spacing:0.3px}
                .va-btn:hover{opacity:0.85;transform:translateY(-1px)}
                .va-btn:active{transform:translateY(0)}
                .va-btn-cancel{background:#1a1a24;color:#fff;border:1px solid #2a2a38;flex:0 0 120px}
                .va-btn-save{background:linear-gradient(135deg,#5865f2,#7c3aed);color:#fff;flex:0 0 160px;margin-left:auto}
            </style>

            <div id="va-box">

                <!-- Top bar -->
                <div class="va-topbar">
                    <div>
                        <div class="va-title">VOIP-Caster</div>
                        <div class="va-subtitle">by ideology</div>
                    </div>
                    <div class="va-badge">Config</div>
                </div>

                <!-- Two column body -->
                <div class="va-body">

                    <!-- LEFT: Audio + Events -->
                    <div class="va-col va-col-left">

                        <div class="va-section">
                            <div class="va-section-label">Voice &amp; Audio</div>
                            <div class="va-row">
                                <div class="va-row-label">Voice</div>
                                <select class="va-select" id="va-voice">
                                    <option value="">System Default</option>
                                    ${voices.map(v => `<option value="${v.name}" ${this.config.voice === v.name ? "selected" : ""}>${v.name} (${v.lang})</option>`).join("")}
                                </select>
                            </div>
                            <div class="va-row">
                                <div class="va-row-label">Volume</div>
                                <div class="va-slider-wrap">
                                    <input type="range" class="va-slider" id="va-volume" min="0" max="1" step="0.05" value="${this.config.volume}">
                                    <div class="va-val" id="va-volume-val">${Math.round(this.config.volume * 100)}%</div>
                                </div>
                            </div>
                            <div class="va-row">
                                <div class="va-row-label">Speed</div>
                                <div class="va-slider-wrap">
                                    <input type="range" class="va-slider" id="va-rate" min="0.5" max="2" step="0.05" value="${this.config.rate}">
                                    <div class="va-val" id="va-rate-val">${this.config.rate.toFixed(1)}x</div>
                                </div>
                            </div>
                            <div class="va-row">
                                <div class="va-row-label">Pitch</div>
                                <div class="va-slider-wrap">
                                    <input type="range" class="va-slider" id="va-pitch" min="0.5" max="2" step="0.05" value="${this.config.pitch}">
                                    <div class="va-val" id="va-pitch-val">${this.config.pitch.toFixed(1)}</div>
                                </div>
                            </div>
                            <div class="va-row">
                                <div class="va-row-label">Cooldown</div>
                                <div class="va-slider-wrap">
                                    <input type="number" class="va-num" id="va-cooldown" min="0" max="60" step="0.5" value="${this.config.cooldown ?? 2}">
                                    <div class="va-val" style="color:#444;min-width:60px;">sec / user</div>
                                </div>
                            </div>
                        </div>

                        <div class="va-section">
                            <div class="va-section-label">Announce Events</div>
                            <div class="va-toggle-grid">
                                <div class="va-toggle ${this.config.announceJoin ? "active" : ""}" data-key="announceJoin"><div class="va-toggle-dot"></div><div class="va-toggle-text">Join</div></div>
                                <div class="va-toggle ${this.config.announceLeave ? "active" : ""}" data-key="announceLeave"><div class="va-toggle-dot"></div><div class="va-toggle-text">Leave</div></div>
                                <div class="va-toggle ${this.config.announceMute ? "active" : ""}" data-key="announceMute"><div class="va-toggle-dot"></div><div class="va-toggle-text">Mute</div></div>
                                <div class="va-toggle ${this.config.announceUnmute ? "active" : ""}" data-key="announceUnmute"><div class="va-toggle-dot"></div><div class="va-toggle-text">Unmute</div></div>
                                <div class="va-toggle ${this.config.announceDeafen ? "active" : ""}" data-key="announceDeafen"><div class="va-toggle-dot"></div><div class="va-toggle-text">Deafen</div></div>
                                <div class="va-toggle ${this.config.announceUndeafen ? "active" : ""}" data-key="announceUndeafen"><div class="va-toggle-dot"></div><div class="va-toggle-text">Undeafen</div></div>
                                <div class="va-toggle ${this.config.announceScreenshareStart ? "active" : ""}" data-key="announceScreenshareStart"><div class="va-toggle-dot"></div><div class="va-toggle-text">Screen Share</div></div>
                                <div class="va-toggle ${this.config.announceScreenshareStop ? "active" : ""}" data-key="announceScreenshareStop"><div class="va-toggle-dot"></div><div class="va-toggle-text">Share Stop</div></div>
                                <div class="va-toggle ${this.config.announceServerMute ? "active" : ""}" data-key="announceServerMute"><div class="va-toggle-dot"></div><div class="va-toggle-text">Server Mute</div></div>
                                <div class="va-toggle ${this.config.announceServerDeafen ? "active" : ""}" data-key="announceServerDeafen"><div class="va-toggle-dot"></div><div class="va-toggle-text">Server Deafen</div></div>
                                <div class="va-toggle va-toggle-full ${this.config.announceSelfJoin ? "active" : ""}" data-key="announceSelfJoin"><div class="va-toggle-dot"></div><div class="va-toggle-text">Announce when YOU join a channel</div></div>
                                <div class="va-toggle va-toggle-full ${this.config.announceSelfLeave ? "active" : ""}" data-key="announceSelfLeave"><div class="va-toggle-dot"></div><div class="va-toggle-text">Announce when YOU leave a channel</div></div>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT: Phrases -->
                    <div class="va-col va-col-right">

                        <div class="va-section">
                            <div class="va-section-label">Announcement Phrases</div>
                            <div class="va-hint">Must contain <span>{name}</span> — e.g. <span>{name} joined</span> or <span>the {name} has arrived</span>.</div>

                            ${[
                                ["va-text-join",          "Join",          this.config.joinText,             true],
                                ["va-text-leave",         "Leave",         this.config.leaveText,            true],
                                ["va-text-mute",          "Mute",          this.config.muteText,             true],
                                ["va-text-unmute",        "Unmute",        this.config.unmuteText,           true],
                                ["va-text-deafen",        "Deafen",        this.config.deafenText,           true],
                                ["va-text-undeafen",      "Undeafen",      this.config.undeafenText,         true],
                                ["va-text-share-start",   "Share Start",   this.config.screenshareStartText, true],
                                ["va-text-share-stop",    "Share Stop",    this.config.screenshareStopText,  true],
                                ["va-text-server-mute",   "Server Mute",   this.config.serverMuteText,       true],
                                ["va-text-server-deafen", "Server Deafen", this.config.serverDeafenText,     true],
                            ].map(([id, label, val, needsName]) => `
                                <div class="va-phrase-row">
                                    <div class="va-phrase-label">${label}</div>
                                    <div class="va-input-wrap">
                                        <input class="va-input" id="${id}" value="${val}" placeholder="${val}" data-needs-name="${needsName}">
                                        <div class="va-err" id="${id}-err">Must contain {name}</div>
                                    </div>
                                    <button class="va-preview-btn" data-preview="${id}">▶</button>
                                </div>
                            `).join("")}

                            <div class="va-divider"></div>
                            <div class="va-note">Self phrases are just for you — no {name} needed.</div>

                            ${[
                                ["va-text-self-join",  "Self Join",  this.config.selfJoinText,  false],
                                ["va-text-self-leave", "Self Leave", this.config.selfLeaveText, false],
                            ].map(([id, label, val]) => `
                                <div class="va-phrase-row">
                                    <div class="va-phrase-label">${label}</div>
                                    <div class="va-input-wrap">
                                        <input class="va-input" id="${id}" value="${val}" placeholder="${val}" data-needs-name="false">
                                    </div>
                                    <button class="va-preview-btn" data-preview="${id}">▶</button>
                                </div>
                            `).join("")}
                        </div>

                    </div>
                </div>

                <!-- Footer -->
                <div class="va-footer">
                    <button class="va-btn va-btn-cancel" id="va-cancel">Cancel</button>
                    <button class="va-btn va-btn-save" id="va-save">Save &amp; Apply</button>
                </div>

            </div>
        `;

        document.body.appendChild(modal);

        const volSlider   = modal.querySelector("#va-volume");
        const rateSlider  = modal.querySelector("#va-rate");
        const pitchSlider = modal.querySelector("#va-pitch");

        volSlider.addEventListener("input",   () => { modal.querySelector("#va-volume-val").textContent = `${Math.round(volSlider.value * 100)}%`; });
        rateSlider.addEventListener("input",  () => { modal.querySelector("#va-rate-val").textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`; });
        pitchSlider.addEventListener("input", () => { modal.querySelector("#va-pitch-val").textContent = parseFloat(pitchSlider.value).toFixed(1); });

        modal.querySelectorAll(".va-toggle").forEach(t => t.addEventListener("click", () => t.classList.toggle("active")));

        modal.querySelectorAll('.va-input[data-needs-name="true"]').forEach(input => {
            input.addEventListener("input", () => {
                const bad = input.value.length > 0 && !input.value.includes("{name}");
                input.classList.toggle("error", bad);
                const err = modal.querySelector(`#${input.id}-err`);
                if (err) err.classList.toggle("show", bad);
            });
        });

        modal.querySelectorAll(".va-preview-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = modal.querySelector(`#${btn.dataset.preview}`);
                const text  = (input?.value || "").replace("{name}", "Alex");
                this._previewSpeak(text, {
                    voice:  modal.querySelector("#va-voice").value,
                    volume: parseFloat(volSlider.value),
                    rate:   parseFloat(rateSlider.value),
                    pitch:  parseFloat(pitchSlider.value),
                });
            });
        });

        modal.querySelector("#va-cancel").addEventListener("click", () => modal.remove());
        modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

        modal.querySelector("#va-save").addEventListener("click", () => {
            let hasErrors = false;
            modal.querySelectorAll('.va-input[data-needs-name="true"]').forEach(input => {
                if (!input.value.includes("{name}")) {
                    input.classList.add("error");
                    const err = modal.querySelector(`#${input.id}-err`);
                    if (err) err.classList.add("show");
                    hasErrors = true;
                }
            });
            if (hasErrors) {
                BdApi.UI.showToast("Fix highlighted phrases — each must contain {name}.", { type: "error" });
                return;
            }

            const g = id => modal.querySelector(id);
            const toggle = key => g(`[data-key='${key}']`).classList.contains('active');

            this.config.voice                 = g("#va-voice").value;
            this.config.volume                = parseFloat(volSlider.value);
            this.config.rate                  = parseFloat(rateSlider.value);
            this.config.pitch                 = parseFloat(pitchSlider.value);
            this.config.cooldown              = parseFloat(g("#va-cooldown").value) || 2;
            this.config.announceJoin              = toggle("announceJoin");
            this.config.announceLeave             = toggle("announceLeave");
            this.config.announceMute              = toggle("announceMute");
            this.config.announceUnmute            = toggle("announceUnmute");
            this.config.announceDeafen            = toggle("announceDeafen");
            this.config.announceUndeafen          = toggle("announceUndeafen");
            this.config.announceScreenshareStart  = toggle("announceScreenshareStart");
            this.config.announceScreenshareStop   = toggle("announceScreenshareStop");
            this.config.announceSelfJoin          = toggle("announceSelfJoin");
            this.config.announceSelfLeave         = toggle("announceSelfLeave");
            this.config.announceServerMute        = toggle("announceServerMute");
            this.config.announceServerDeafen      = toggle("announceServerDeafen");
            this.config.joinText                  = g("#va-text-join").value             || DEFAULT_CONFIG.joinText;
            this.config.leaveText                 = g("#va-text-leave").value            || DEFAULT_CONFIG.leaveText;
            this.config.muteText                  = g("#va-text-mute").value             || DEFAULT_CONFIG.muteText;
            this.config.unmuteText                = g("#va-text-unmute").value           || DEFAULT_CONFIG.unmuteText;
            this.config.deafenText                = g("#va-text-deafen").value           || DEFAULT_CONFIG.deafenText;
            this.config.undeafenText              = g("#va-text-undeafen").value         || DEFAULT_CONFIG.undeafenText;
            this.config.screenshareStartText      = g("#va-text-share-start").value      || DEFAULT_CONFIG.screenshareStartText;
            this.config.screenshareStopText       = g("#va-text-share-stop").value       || DEFAULT_CONFIG.screenshareStopText;
            this.config.serverMuteText            = g("#va-text-server-mute").value      || DEFAULT_CONFIG.serverMuteText;
            this.config.serverDeafenText          = g("#va-text-server-deafen").value    || DEFAULT_CONFIG.serverDeafenText;
            this.config.selfJoinText              = g("#va-text-self-join").value        || DEFAULT_CONFIG.selfJoinText;
            this.config.selfLeaveText             = g("#va-text-self-leave").value       || DEFAULT_CONFIG.selfLeaveText;
            this.config.configured                = true;

            this._saveConfig();
            modal.remove();
            BdApi.UI.showToast("VOIP-Caster: Configuration saved!", { type: "success" });
        });
    }

    // ─ Voice helpers ─

    _previewSpeak(text, { voice, volume, rate, pitch }) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.volume = volume; msg.rate = rate; msg.pitch = pitch;
        if (voice) { const m = speechSynthesis.getVoices().find(v => v.name === voice); if (m) msg.voice = m; }
        speechSynthesis.cancel();
        speechSynthesis.speak(msg);
    }

    speak(text) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.volume = this.config.volume; msg.rate = this.config.rate; msg.pitch = this.config.pitch;
        if (this.config.voice) { const m = speechSynthesis.getVoices().find(v => v.name === this.config.voice); if (m) msg.voice = m; }
        speechSynthesis.cancel();
        speechSynthesis.speak(msg);
    }

    // ─ Core logic ─

    _seedInitialState() {
        const channelId = this._getChannelId();
        this._prevSelfChannelId = channelId;
        if (!channelId) return;
        const states = this._getVoiceStates(channelId);
        if (!states) return;
        for (const state of Object.values(states)) {
            this.voiceStates[state.userId] = {
                selfMute:   !!state.selfMute,
                selfDeaf:   !!state.selfDeaf,
                selfStream: !!state.selfStream,
                mute:       !!state.mute,
                deaf:       !!state.deaf,
            };
        }
    }

    // Only fires when you're actually connected to a voice channel
    _getChannelId() {
        try {
            const state = this.VoiceStateStore.getVoiceStateForUser?.(this.currentUserId);
            return state?.channelId ?? null;
        } catch {
            return null;
        }
    }

    _getVoiceStates(channelId) {
        try {
            const raw = this.VoiceStateStore.getVoiceStatesForChannel(channelId);
            if (!raw) return null;
            if (raw instanceof Map) return Object.fromEntries(raw);
            return raw;
        } catch { return null; }
    }

    checkStates() {
        if (!this.SelectedChannelStore || !this.VoiceStateStore || !this.UserStore) return;

        const channelId = this._getChannelId();
        const fmt = (tpl, name) => tpl.replace("{name}", name);

        // ─ Self join / leave ─
        if (channelId !== this._prevSelfChannelId) {
            if (!this._prevSelfChannelId && channelId && this.config.announceSelfJoin)
                this.speak(this.config.selfJoinText);
            else if (this._prevSelfChannelId && !channelId && this.config.announceSelfLeave)
                this.speak(this.config.selfLeaveText);
            this._prevSelfChannelId = channelId;
        }

        if (!channelId) { this.voiceStates = {}; return; }

        const states = this._getVoiceStates(channelId);
        if (!states) return;

        const currentIds = new Set();

        for (const state of Object.values(states)) {
            if (state.userId === this.currentUserId) continue;
            currentIds.add(state.userId);

            const user = this.UserStore.getUser(state.userId);
            if (!user) continue;
            const name = user.globalName ?? user.username;

            const old        = this.voiceStates[state.userId];
            const newMute    = !!state.selfMute;
            const newDeaf    = !!state.selfDeaf;
            const newStream  = !!state.selfStream;
            const newSrvMute = !!state.mute;
            const newSrvDeaf = !!state.deaf;

            if (!old) {
                if (this.config.announceJoin && this._canSpeak(state.userId, "join"))
                    this.speak(fmt(this.config.joinText, name));
            } else {
                // Server mute/deafen first (admin action)
                if (!old.deaf && newSrvDeaf && this.config.announceServerDeafen && this._canSpeak(state.userId, "srvDeaf"))
                    this.speak(fmt(this.config.serverDeafenText, name));
                else if (!old.mute && newSrvMute && this.config.announceServerMute && this._canSpeak(state.userId, "srvMute"))
                    this.speak(fmt(this.config.serverMuteText, name));
                // Self deafen/undeafen
                else if (!old.selfDeaf && newDeaf && this.config.announceDeafen && this._canSpeak(state.userId, "deafen"))
                    this.speak(fmt(this.config.deafenText, name));
                else if (old.selfDeaf && !newDeaf && this.config.announceUndeafen && this._canSpeak(state.userId, "undeafen"))
                    this.speak(fmt(this.config.undeafenText, name));
                // Self mute/unmute
                else if (!old.selfMute && newMute && this.config.announceMute && this._canSpeak(state.userId, "mute"))
                    this.speak(fmt(this.config.muteText, name));
                else if (old.selfMute && !newMute && this.config.announceUnmute && this._canSpeak(state.userId, "unmute"))
                    this.speak(fmt(this.config.unmuteText, name));

                // Screen share (independent check)
                if (!old.selfStream && newStream && this.config.announceScreenshareStart && this._canSpeak(state.userId, "shareStart"))
                    this.speak(fmt(this.config.screenshareStartText, name));
                else if (old.selfStream && !newStream && this.config.announceScreenshareStop && this._canSpeak(state.userId, "shareStop"))
                    this.speak(fmt(this.config.screenshareStopText, name));
            }

            this.voiceStates[state.userId] = { selfMute: newMute, selfDeaf: newDeaf, selfStream: newStream, mute: newSrvMute, deaf: newSrvDeaf };
        }

        // Left
        for (const userId of Object.keys(this.voiceStates)) {
            if (!currentIds.has(userId)) {
                const user = this.UserStore.getUser(userId);
                if (user && this.config.announceLeave && this._canSpeak(userId, "leave"))
                    this.speak(fmt(this.config.leaveText, user.globalName ?? user.username));
                delete this.voiceStates[userId];
                delete this._cooldowns[userId];
            }
        }
    }
};