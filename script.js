// ==========================================
// 1. VARIABLES Y REFERENCIAS AL DOM (HTML)
// ==========================================
let audioClips = []; // Aquí guardaremos los audios originales y tus grabaciones
let currentIndex = 0;
let mediaRecorder;
let audioChunks = [];

// Referencias a las secciones
const uploadSection = document.getElementById('upload-section');
const studioSection = document.getElementById('studio-section');
const exportSection = document.getElementById('export-section');

// Textos y controles de audio
const charNameEl = document.getElementById('char-name');
const clipCurrentEl = document.getElementById('clip-current');
const clipTotalEl = document.getElementById('clip-total');
const translatedTextEl = document.getElementById('translated-text');
const audioOriginal = document.getElementById('audio-original');
const audioRecorded = document.getElementById('audio-recorded');

// Botones
const zipUpload = document.getElementById('zip-upload');
const uploadStatus = document.getElementById('upload-status');
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnExport = document.getElementById('btn-export');

// ==========================================
// 2. LECTURA Y EXTRACCIÓN DEL ARCHIVO .ZIP
// ==========================================
zipUpload.addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploadStatus.textContent = "Procesando paquete de voces... ⏳";
    audioClips = []; // Reiniciamos por si subes otro zip
    
    try {
        // Usamos JSZip (la librería que pusimos en el HTML) para leer el archivo
        const zip = await JSZip.loadAsync(file);
        
        // Buscamos archivos de audio dentro del zip
        for (const relativePath in zip.files) {
            const zipEntry = zip.files[relativePath];
            
            // Filtramos solo archivos de audio comunes en mods (.wav, .mp3, .ogg)
            if (!zipEntry.dir && relativePath.match(/\.(wav|mp3|ogg)$/i)) {
                const blob = await zipEntry.async("blob");
                
                audioClips.push({
                    path: relativePath, // Guardamos la ruta original para el mod
                    filename: zipEntry.name.split('/').pop(),
                    originalBlob: blob,
                    recordedBlob: null // Aquí irá tu voz después
                });
            }
        }

        if (audioClips.length > 0) {
            uploadStatus.textContent = `¡Éxito! Se encontraron ${audioClips.length} clips de audio.`;
            clipTotalEl.textContent = audioClips.length;
            
            // Ocultamos la subida y mostramos el estudio
            setTimeout(() => {
                uploadSection.classList.add('hidden');
                studioSection.classList.remove('hidden');
                loadClip(0); // Cargamos el primer clip
            }, 1000);
        } else {
            uploadStatus.textContent = "❌ No se encontraron archivos de audio en este .zip";
        }
        
    } catch (error) {
        console.error(error);
        uploadStatus.textContent = "❌ Error al leer el archivo .zip";
    }
});

// ==========================================
// 3. CARGAR UN CLIP EN EL ESTUDIO
// ==========================================
function loadClip(index) {
    currentIndex = index;
    const clip = audioClips[currentIndex];
    
    // Actualizar contadores y nombres
    clipCurrentEl.textContent = currentIndex + 1;
    charNameEl.textContent = clip.path.split('/')[0] || "Desconocido"; // Intenta sacar el nombre de la carpeta
    
    // Cargar el audio original
    audioOriginal.src = URL.createObjectURL(clip.originalBlob);
    
    // Si ya habías grabado algo para este clip, lo mostramos
    if (clip.recordedBlob) {
        audioRecorded.src = URL.createObjectURL(clip.recordedBlob);
        audioRecorded.classList.remove('hidden');
    } else {
        audioRecorded.src = "";
        audioRecorded.classList.add('hidden');
    }

    // Actualizar botones de navegación
    btnPrev.disabled = currentIndex === 0;
    
    if (currentIndex === audioClips.length - 1) {
        btnNext.disabled = true;
        // Si estamos en el último clip, mostramos el panel de exportar
        exportSection.classList.remove('hidden');
    } else {
        btnNext.disabled = false;
    }

    // SIMULACIÓN DE TRADUCCIÓN:
    // (Ver "La Nota Técnica" abajo para entender esta parte)
    translatedTextEl.textContent = `[Traduciendo clip: ${clip.filename}] - "Simulación de subtítulo en castellano generado por IA."`;
}

// Navegación
btnPrev.addEventListener('click', () => loadClip(currentIndex - 1));
btnNext.addEventListener('click', () => loadClip(currentIndex + 1));

// ==========================================
// 4. GRABACIÓN DE VOZ (Micrófono)
// ==========================================
btnRecord.addEventListener('click', async () => {
    try {
        // Pedimos permiso para usar el micrófono de tu ThinkPad
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            // Cuando paras, creamos el archivo de audio con tu voz
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            
            // Lo guardamos en el clip actual
            audioClips[currentIndex].recordedBlob = audioBlob;
            
            // Lo ponemos en el reproductor para que lo escuches
            audioRecorded.src = URL.createObjectURL(audioBlob);
            audioRecorded.classList.remove('hidden');
            
            // Apagamos el micrófono para ahorrar memoria
            stream.getTracks().forEach(track => track.stop());
        };

        // Empezamos a grabar
        mediaRecorder.start();
        
        // Cambiamos los botones
        btnRecord.classList.add('hidden');
        btnStop.classList.remove('hidden');
        translatedTextEl.style.color = "var(--accent-red)"; // Efecto visual de "grabando"

    } catch (err) {
        alert("❌ Error: No se pudo acceder al micrófono. Revisa los permisos de tu navegador.");
        console.error(err);
    }
});

btnStop.addEventListener('click', () => {
    mediaRecorder.stop();
    btnRecord.classList.remove('hidden');
    btnStop.classList.add('hidden');
    translatedTextEl.style.color = "var(--text-main)";
});

// ==========================================
// 5. EXPORTAR EL MOD (Generar el nuevo .ZIP)
// ==========================================
btnExport.addEventListener('click', async () => {
    btnExport.textContent = "Generando Mod... ⏳";
    btnExport.disabled = true;

    const newZip = new JSZip();

    audioClips.forEach(clip => {
        // Si grabaste tu voz, usamos la tuya. Si te saltaste este clip, dejamos la original.
        const fileToSave = clip.recordedBlob ? clip.recordedBlob : clip.originalBlob;
        
        // Lo guardamos en la MISMA RUTA exacta para que el juego lo reconozca
        newZip.file(clip.path, fileToSave);
    });

    // Generamos el archivo final
    const zipBlob = await newZip.generateAsync({ type: "blob" });
    
    // Forzamos la descarga en el navegador
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = "My_Voice_Choicer_Mod.zip";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    btnExport.textContent = "✅ ¡Mod Descargado!";
    setTimeout(() => {
        btnExport.textContent = "Descargar Modificado (.zip)";
        btnExport.disabled = false;
    }, 3000);
});
