/* =========================================
   Kazakh Course — core app.js (all weeks)
   RULES:
   - Light-only (no dark switchers)
   - No focus-mode
   - No tilt/3D/rotations
   - Stable UX: reveal, smooth scroll, practice answers, translations, TTS, tests
   ========================================= */

   document.addEventListener("DOMContentLoaded", () => {
    /* ---------- Helpers ---------- */
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  
    /* ---------- Enforce LIGHT theme (compat only) ---------- */
    document.documentElement.setAttribute("data-theme", "light");
    const metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) metaScheme.setAttribute("content", "light");
  
    /* ---------- Disable any tilt hooks (if present in markup) ---------- */
    $$("[data-tilt], [data-tilt-enable], [data-vanilla-tilt]").forEach((el) => {
      el.setAttribute("data-tilt-disabled", "true");
    });
  
    /* ---------- Active nav (weeks nav) ---------- */
    // page: "index" | "week1" | "week2" | ... | "dictionary"
    const page = document.body?.dataset?.page || "";
  
    const normalizePath = (href) => {
      try {
        const u = new URL(href, window.location.href);
        return (u.pathname.split("/").pop() || "").toLowerCase();
      } catch {
        return (href || "").toLowerCase();
      }
    };
  
    const guessPageFromHref = (href) => {
      const p = normalizePath(href);
      if (!p) return "";
      if (p === "index.html" || p === "./") return "index";
      if (p === "dictionary.html") return "dictionary";
      const m = p.match(/^week(\d+)\.html$/);
      if (m) return `week${m[1]}`;
      return "";
    };
  
    if (page) {
      $$(".nav.nav--weeks a.nav__link").forEach((a) => {
        const dp = a.getAttribute("data-page") || "";
        const inferred = dp || guessPageFromHref(a.getAttribute("href") || "");
        if (inferred === page) a.classList.add("is-active");
        else a.classList.remove("is-active");
      });
    }
  
    /* ---------- Smooth scroll (anchors) ---------- */
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
  
      const href = a.getAttribute("href");
      if (!href || href === "#" || href.length < 2) return;
  
      const target = document.querySelector(href);
      if (!target) return;
  
      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
      history.replaceState(null, "", href);
    });
  
    /* ---------- Scroll reveal (unified) ----------
       HTML: uses [data-reveal] (week pages) and sometimes .reveal (index)
       CSS: expects .reveal + html.reveal-ready + .is-in
       Strategy:
       - add .reveal to all [data-reveal]
       - enable html.reveal-ready
       - reveal by adding .is-in
    */
    const revealEls = [
      ...$$("[data-reveal]").map((el) => {
        el.classList.add("reveal");
        return el;
      }),
      ...$$(".reveal"),
    ];
  
    if (revealEls.length) {
      document.documentElement.classList.add("reveal-ready");
  
      const revealNow = (el) => el.classList.add("is-in");
  
      if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        revealEls.forEach(revealNow);
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              revealNow(en.target);
              io.unobserve(en.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
        );
        revealEls.forEach((el) => io.observe(el));
      }
    }
  
    /* ---------- Practice answers: [data-practice="id"] -> #id ---------- */
    const setPracticeExpanded = (btn, box, expanded) => {
      btn.setAttribute("aria-expanded", String(expanded));
      box.hidden = !expanded;
      btn.textContent = expanded ? "Жасыру" : "Жауапты көрсету";
    };
  
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-practice]");
      if (!btn) return;
  
      const id = btn.getAttribute("data-practice");
      const box = id ? document.getElementById(id) : null;
      if (!box) return;
  
      const expanded = btn.getAttribute("aria-expanded") === "true";
      setPracticeExpanded(btn, box, !expanded);
    });
  
    /* ---------- Phrase translations: #togglePhraseTranslations controls [data-translation] ---------- */
    const phraseTransBtn = $("#togglePhraseTranslations");
    const phraseTransEls = $$("[data-translation]");
  
    const setPhraseTranslations = (show) => {
      phraseTransEls.forEach((el) => {
        el.hidden = !show;
        el.classList.toggle("is-hidden", !show);
      });
      if (phraseTransBtn) phraseTransBtn.setAttribute("aria-pressed", String(show));
      localStorage.setItem("kc_phrase_translations", show ? "1" : "0");
    };
  
    if (phraseTransBtn && phraseTransEls.length) {
      const saved = localStorage.getItem("kc_phrase_translations") === "1";
      setPhraseTranslations(saved);
  
      phraseTransBtn.addEventListener("click", () => {
        const now = phraseTransBtn.getAttribute("aria-pressed") === "true";
        setPhraseTranslations(!now);
      });
    } else if (phraseTransBtn) {
      phraseTransBtn.disabled = true;
      phraseTransBtn.setAttribute("aria-disabled", "true");
    }
  
    /* ---------- Global stop for any <audio id="phraseAudio"> (safe, optional) ---------- */
    const audio = $("#phraseAudio");
    const stopAudioIfAny = () => {
      if (!audio) return;
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    };
  
    /* ---------- TTS (SpeechSynthesis) ---------- */
    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      let activeBtn = null;
      let speaking = false;
  
      const setTtsState = (btn, on) => {
        btn.classList.toggle("is-playing", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      };
  
      const stopTts = () => {
        try {
          window.speechSynthesis.cancel();
        } catch {}
        if (activeBtn) setTtsState(activeBtn, false);
        activeBtn = null;
        speaking = false;
      };
  
      const pickVoice = (lang) => {
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) return null;
  
        const want = (lang || "").toLowerCase();
  
        let v = voices.find((x) => (x.lang || "").toLowerCase() === want);
        if (v) return v;
  
        const pref = want.split("-")[0];
        if (pref) {
          v = voices.find((x) => (x.lang || "").toLowerCase().startsWith(pref));
          if (v) return v;
        }
  
        return voices[0] || null;
      };
  
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tts]");
        if (!btn) return;
  
        stopAudioIfAny();
  
        let text = (btn.getAttribute("data-tts") || "").trim();
        const lang = btn.getAttribute("data-lang") || "kk-KZ";
  
        if (!text) {
          const card = btn.closest(".phraseCard");
          const kk = card ? $(".phraseCard__kk", card) : null;
          text = (kk?.textContent || "").trim();
        }
        if (!text) return;
  
        if (activeBtn === btn && speaking) {
          stopTts();
          return;
        }
  
        stopTts();
  
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
  
        const voice = pickVoice(lang);
        if (voice) utter.voice = voice;
  
        utter.onstart = () => {
          activeBtn = btn;
          speaking = true;
          setTtsState(btn, true);
        };
  
        utter.onend = () => stopTts();
        utter.onerror = () => stopTts();
  
        try {
          window.speechSynthesis.speak(utter);
        } catch {
          stopTts();
        }
      });
  
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && activeBtn) stopTts();
      });
    }
  
    /* ---------- Tests (aria-pressed + reset) ---------- */
    const testItems = $$(".testItem");
    const resetBtn = $("[data-test-reset]");
  
    const ensureInteractive = (el) => {
      const tag = el.tagName.toLowerCase();
      if (tag !== "button" && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    };
  
    testItems.forEach((el) => {
      ensureInteractive(el);
  
      const toggle = () => {
        const now = el.getAttribute("aria-pressed") === "true";
        el.setAttribute("aria-pressed", String(!now));
      };
  
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        testItems.forEach((el) => el.setAttribute("aria-pressed", "false"));
      });
    }
  });
  /* =========================================
     SIMPLE MP3 PLAYER (Global handler)
     Ищет кнопки с атрибутом onclick="playAudio(...)" 
     или можно сделать через data-src
     ========================================= */
  
     let currentAudio = null;
     let currentBtn = null;
   
     // Делаем функцию глобальной, чтобы она работала из HTML (onclick="playAudio(...)")
     window.playAudio = (btn, src) => {
       // 1. Если нажали ту же кнопку (Пауза)
       if (currentBtn === btn && currentAudio) {
         if (currentAudio.paused) {
           currentAudio.play();
           btn.innerText = '⏸'; // Или меняем класс иконки
           btn.classList.add('is-playing');
         } else {
           currentAudio.pause();
           btn.innerText = '▶';
           btn.classList.remove('is-playing');
         }
         return;
       }
   
       // 2. Сброс предыдущего
       if (currentAudio) {
         currentAudio.pause();
         currentAudio.currentTime = 0;
         if (currentBtn) {
           currentBtn.innerText = '▶';
           currentBtn.classList.remove('is-playing');
         }
       }
   
       // 3. Новый трек
       currentAudio = new Audio(src);
       currentBtn = btn;
   
       currentAudio.play().catch(err => console.error("Audio error:", err));
   
       btn.innerText = '⏸';
       btn.classList.add('is-playing');
   
       // 4. Когда трек закончился
       currentAudio.onended = () => {
         btn.innerText = '▶';
         btn.classList.remove('is-playing');
         currentAudio = null;
         currentBtn = null;
       };
     };
     // --- PHONE CHAT LOGIC ---
    let currentMsgIndex = 0;

    function showNextMessage() {
      const messages = document.querySelectorAll('.msg');
      const chatArea = document.getElementById('chatScrollArea');
      const btn = document.getElementById('nextMsgBtn');

      if (currentMsgIndex < messages.length) {
        // Хабарламаны көрсету
        messages[currentMsgIndex].classList.remove('msg-hidden');
        
        // Төменге скролл жасау
        chatArea.scrollTop = chatArea.scrollHeight;
        
        currentMsgIndex++;
      }

      // Егер хабарламалар бітсе
      if (currentMsgIndex >= messages.length) {
        btn.innerText = "Диалог аяқталды ↺";
        btn.onclick = resetChat; // Функцияны өзгерту
        btn.classList.add('btn--ghost');
      }
    }

    function resetChat() {
      const messages = document.querySelectorAll('.msg');
      const btn = document.getElementById('nextMsgBtn');
      
      // Барлығын қайта жасыру
      messages.forEach(msg => msg.classList.add('msg-hidden'));
      currentMsgIndex = 0;
      
      // Түймені қалпына келтіру
      btn.innerText = "Келесі хабарлама (Next) ↓";
      btn.classList.remove('btn--ghost');
      btn.onclick = showNextMessage;
    }