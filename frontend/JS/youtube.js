async function getTrailer(movieId) {
    const res = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`);
    const videoData = await res.json();
    
    // Filtramos para encontrar el video que sea un Tráiler en YouTube
    const trailer = videoData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
    
    if(trailer) {
        const videoId = trailer.key;
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.innerHTML = `
            <iframe width="100%" height="400" 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
            frameborder="0" allowfullscreen></iframe>
        `;
        document.getElementById('movieModal').style.display = 'block';
    } else {
        alert("Tráiler no disponible");
    }
}