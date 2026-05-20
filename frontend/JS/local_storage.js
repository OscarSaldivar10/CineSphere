function addToWatchlist(movie) {
    let watchlist = JSON.parse(localStorage.getItem('myWatchlist')) || [];
    
    // Evitar duplicados
    if(!watchlist.find(m => m.id === movie.id)) {
        watchlist.push(movie);
        localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
        alert("Añadido a tu lista");
    }
}