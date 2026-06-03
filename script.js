document.addEventListener("DOMContentLoaded", () => {
    console.log("Card system optimized with auto-cleanup.");

    const urlInput = document.getElementById("urlInput");
    if (urlInput) urlInput.addEventListener("focus", () => urlInput.value = "");

    document.getElementById("generateBtn").addEventListener("click", generateCard);
    document.getElementById("borderToggle").addEventListener("change", toggleBorders);
    document.getElementById("dynamicBgToggle").addEventListener("change", toggleDynamicBg);
    document.getElementById("presetDarkBtn").addEventListener("click", () => setCardPreset('dark'));
    document.getElementById("presetLightBtn").addEventListener("click", () => setCardPreset('light'));
    
    const colorPicker = document.getElementById("cardColorPicker");
    if (colorPicker) colorPicker.addEventListener("input", (e) => setCustomColor(e.target.value));

    document.getElementById("downloadFrontBtn").addEventListener("click", () => downloadCard('musicCardFront', 'cardfront'));
    document.getElementById("downloadBackBtn").addEventListener("click", () => downloadCard('musicCardBack', 'cardback'));

    setCardPreset('dark');
    updateCardBlurs('cover.png');

    const slider = document.getElementById("progressSlider");
    if (slider) slider.addEventListener("input", updateSliderTime);
});

// HELPERS COMPARTIDOS
const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const updateCardBlurs = (src) => {
    applyBlurToElement('cardBlurBgFront', src);
    applyBlurToElement('cardBlurBgBack', src);
};

// ESTILOS Y COMPORTAMIENTO
function toggleBorders() {
    const isRounded = document.getElementById('borderToggle').checked;
    document.querySelectorAll('.card').forEach(card => card.style.setProperty('--card-radius', isRounded ? '16px' : '0px'));
}

function toggleDynamicBg() {
    const isDynamic = document.getElementById('dynamicBgToggle').checked;
    document.querySelectorAll('.card').forEach(card => card.classList.toggle('solid-mode', !isDynamic));
}

function setCardPreset(mode) {
    const picker = document.getElementById('cardColorPicker');
    const isDark = mode === 'dark';
    const bgColor = isDark ? '#1a1a1d' : '#f0f0f3';
    const textColor = isDark ? '#ffffff' : '#1a1a1d';
    
    if (picker) picker.value = bgColor;
    updateCardColors(bgColor, textColor);
}

function setCustomColor(colorCode) {
    const r = parseInt(colorCode.substr(1, 2), 16);
    const g = parseInt(colorCode.substr(3, 2), 16);
    const b = parseInt(colorCode.substr(5, 2), 16);
    const luminosity = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    updateCardColors(colorCode, luminosity > 0.5 ? '#1a1a1d' : '#ffffff');
}

function updateCardColors(bgColor, textColor) {
    document.querySelectorAll('.card').forEach(card => {
        card.style.setProperty('--bg-card', bgColor);
        card.style.setProperty('--text-card-color', textColor);
    });
    const albumTag = document.getElementById('cardAlbum');
    if (albumTag) albumTag.style.color = textColor === '#ffffff' ? '#888888' : '#555555';
}

async function generateCard() {
    const urlInput = document.getElementById('urlInput');
    let url = urlInput ? urlInput.value.trim() : "";

    if (!url) {
        alert('Please paste a valid YouTube Music link.');
        resetToDefaultCard();
        return;
    }

    url = url.split('&')[0].split('?si=')[0];
    if (urlInput) urlInput.value = url;

    const qrImg = document.getElementById('cardQR');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

    try {
        const responseOEmbed = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url.replace('music.', ''))}`);
        const dataOEmbed = await responseOEmbed.json();
        if (dataOEmbed.error) throw new Error();

        let artistName = (dataOEmbed.author_name || "Unknown Artist").replace(/\s*-\s*Topic$/i, '').trim();
        let rawTitle = dataOEmbed.title || "Unknown Song";
        
        let cleanTitle = rawTitle.replace(/[\(\[][^\]\)]*[\)\]]/g, "");
        
        if (cleanTitle.includes('-')) {
            const parts = cleanTitle.split('-');
            if (/(live|video|remix|acoustic|lyric|version|official)/i.test(parts[1])) {
                cleanTitle = parts[0];
            }
        }
        
        cleanTitle = cleanTitle.trim();

        document.getElementById('cardTitle').innerText = cleanTitle;
        document.getElementById('cardArtist').innerText = artistName;
        document.getElementById('cardAlbum').innerText = "Single / Video";
        document.getElementById('cardDuration').innerText = "3:30";

        let ytThumb = dataOEmbed.thumbnail_url.replace('hqdefault', 'maxresdefault');
        document.getElementById('cardCover').src = ytThumb;
        updateCardBlurs(ytThumb);

        const searchTerms = `${artistName} ${cleanTitle}`;
        const iTunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerms)}&media=music&limit=25`);
        const iTunesData = await iTunesResponse.json();

        if (iTunesData.results?.length > 0) {
            const blacklist = /(live|video|remix|acoustic|concert|version|mix|edit)/i;

            const scoredResults = iTunesData.results.map(t => {
                const trackName = t.trackName || "";
                const collectionName = t.collectionName || "";
                const kind = t.kind || "";
                
                let score = 0;

                if (kind === "music-video" || blacklist.test(trackName) || blacklist.test(collectionName)) {
                    score = 0;
                } 
                else if (!/(single|ep)/i.test(collectionName)) {
                    score = 3; 
                } 
                else if (/ep/i.test(collectionName)) {
                    score = 2;
                } 
                else if (/single/i.test(collectionName)) {
                    score = 1;
                }

                return { track: t, score: score };
            });

            scoredResults.sort((a, b) => b.score - a.score);

            let bestMatch = scoredResults[0];
            let track = bestMatch.track;

            if (bestMatch.score === 0) {
                track = iTunesData.results[0];
            }

            if (track.collectionName) document.getElementById('cardAlbum').innerText = track.collectionName;

            if (track.trackTimeMillis) {
                const totalSeconds = Math.floor(track.trackTimeMillis / 1000);
                document.getElementById('cardDuration').innerText = formatTime(totalSeconds);

                const slider = document.getElementById("progressSlider");
                if (slider) {
                    slider.max = totalSeconds;
                    slider.value = Math.floor(totalSeconds * 0.35);
                    updateSliderTime();
                }
            }
            if (track.artworkUrl100) {
                const highResCover = track.artworkUrl100.replace('100x100bb', '600x600bb');
                document.getElementById('cardCover').src = highResCover;
                updateCardBlurs(highResCover);
            }
        }
    } catch (error) {
        resetToDefaultCard();
    }
}

function resetToDefaultCard() {
    document.getElementById('cardTitle').innerText = "Song Title";
    document.getElementById('cardArtist').innerText = "Artist";
    document.getElementById('cardAlbum').innerText = "Album";
    document.getElementById('cardDuration').innerText = "0:00";
    document.getElementById('cardCurrentTime').innerText = "0:00";
    document.getElementById('cardCover').src = "cover.png";
    
    const qrImg = document.getElementById('cardQR');
    if (qrImg) qrImg.src = "qr.png";
    
    updateCardBlurs('cover.png');
    
    const slider = document.getElementById("progressSlider");
    if (slider) {
        slider.max = 100;
        slider.value = 0;
    }
}

function updateSliderTime() {
    const slider = document.getElementById("progressSlider");
    const currentTimeTrack = document.getElementById("cardCurrentTime");
    if (!slider || !currentTimeTrack) return;

    const val = parseInt(slider.value, 10);
    const max = parseInt(slider.max, 10) || 100;
    const percentage = (val / max) * 100;

    const cardFront = document.getElementById("musicCardFront");
    const isCardLight = cardFront && cardFront.style.getPropertyValue('--text-card-color') === '#1a1a1d';
    const trackColor = isCardLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)';

    slider.style.background = `linear-gradient(to right, #ff0000 0%, #ff0000 ${percentage}%, ${trackColor} ${percentage}%, ${trackColor} 100%)`;
    currentTimeTrack.innerText = formatTime(val);
}

function applyBlurToElement(elementId, imgSrc) {
    const imgElement = document.getElementById(elementId);
    if (!imgElement) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    img.onload = function () {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = 40;

        ctx.drawImage(img, 0, 0, 40, 40);
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 5; i++) ctx.drawImage(canvas, -1, -1, 42, 42);

        imgElement.src = canvas.toDataURL();
    };
    img.onerror = () => imgElement.src = imgSrc;
}

function downloadCard(elementId, suffix) {
    const card = document.getElementById(elementId);
    if (!card) return;

    if (typeof html2canvas === "undefined") {
        alert("The download library is loading. Please retry.");
        return;
    }

    const titleElement = document.getElementById('cardTitle');
    let cleanTitle = (titleElement ? titleElement.innerText.trim() : "song")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    if (!cleanTitle || cleanTitle === "song-title") cleanTitle = "music";

    html2canvas(card, { useCORS: true, allowTaint: false, scale: 2 })
        .then(canvas => {
            const link = document.createElement('a');
            link.download = `${cleanTitle}-${suffix}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        })
        .catch(err => {
            console.error(err);
            alert("Error processing the card download image.");
        });
}