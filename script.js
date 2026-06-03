document.addEventListener("DOMContentLoaded", () => {
    console.log("¡Generador listo y optimizado para descargas!");

    document.querySelector(".btn-primary").addEventListener("click", generateCard);
    document.querySelector(".btn-secondary").addEventListener("click", toggleLayout);
    document.getElementById("borderToggle").addEventListener("change", toggleBorders);
    
    document.getElementById("downloadFrontBtn").addEventListener("click", () => downloadCard('musicCardFront', 'music-card-front.png'));
    document.getElementById("downloadBackBtn").addEventListener("click", () => downloadCard('musicCardBack', 'music-card-back.png'));
});

// Cambiar entre Modo Vertical y Horizontal (Afecta también al wrapper)
function toggleLayout() {
    const wrappers = document.querySelectorAll('.card-wrapper');
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        card.classList.toggle('vertical');
        card.classList.toggle('horizontal');
    });

    // Le avisamos al contenedor que cambie su comportamiento según la tarjeta interna
    wrappers.forEach(wrapper => {
        wrapper.classList.toggle('horizontal-layout');
    });
}

function toggleBorders() {
    const isRounded = document.getElementById('borderToggle').checked;
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        if (isRounded) {
            card.style.setProperty('--card-radius', '16px');
        } else {
            card.style.setProperty('--card-radius', '0px');
        }
    });
}

async function generateCard() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput ? urlInput.value.trim() : "";
    
    if (!url) {
        alert('Por favor, pega un link válido de YouTube Music.');
        return;
    }

    // --- NUEVO QR COMPATIBLE CON HTML2CANVAS (CORS Abierto) ---
    try {
        const qrImg = document.getElementById('cardQR');
        if (qrImg) {
            // Usamos la API de goqr.me que no bloquea las descargas de imágenes en Canvas
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
        }
    } catch (e) { console.error("Error QR:", e); }

    const videoUrl = url.replace('music.', '');
    
    try {
        const responseOEmbed = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
        const dataOEmbed = await responseOEmbed.json();
        
        if (dataOEmbed.error) throw new Error('Link no reconocido');

        let originalTitle = dataOEmbed.title || "Canción Desconocida";
        let artistName = dataOEmbed.author_name || "Artista Desconocido";
        
        artistName = artistName.replace(/\s*-\s*Topic$/i, '').trim();
        let cleanTitle = originalTitle.replace(/\s*[\(\[][^)]*[\)\]]/g, "").trim();

        document.getElementById('cardTitle').innerText = cleanTitle;
        document.getElementById('cardArtist').innerText = artistName;
        document.getElementById('cardAlbum').innerText = "Single / Video";
        document.getElementById('cardDuration').innerText = "3:30";
        document.getElementById('cardCover').src = dataOEmbed.thumbnail_url.replace('hqdefault', 'maxresdefault');

        const searchTerms = `${artistName} ${cleanTitle}`;
        const iTunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerms)}&media=music&limit=1`);
        const iTunesData = await iTunesResponse.json();
        
        if (iTunesData.results && iTunesData.results.length > 0) {
            const track = iTunesData.results[0];
            if (track.collectionName) document.getElementById('cardAlbum').innerText = track.collectionName;
            
            if (track.trackTimeMillis) {
                const totalSeconds = Math.floor(track.trackTimeMillis / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                document.getElementById('cardDuration').innerText = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            }
            if (track.artworkUrl100) {
                document.getElementById('cardCover').src = track.artworkUrl100.replace('100x100bb', '600x600bb');
            }
        }
    } catch (error) {
        console.warn("Se usaron datos base de YouTube.");
    }
}

function downloadCard(elementId, fileName) {
    const card = document.getElementById(elementId);
    if (!card) return;

    // Aseguramos que html2canvas refresque y espere las imágenes externas
    html2canvas(card, { 
        useCORS: true, 
        allowTaint: false,
        logging: false,
        scale: 2 
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error(err);
        alert("Error al procesar la imagen de descarga.");
    });
}