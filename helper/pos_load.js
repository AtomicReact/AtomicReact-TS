if (Object.keys(this[ATOMIC_REACT][DEFINES]).length == 0) {
    
    window.addEventListener(this[ATOMIC_REACT][LIB].AtomicReact.AtomicEvents.LOADED, function (event) {
        window.addEventListener("load", function (event) {
            if (this[ATOMIC_REACT][LIB].AtomicReact.onLoad) this[ATOMIC_REACT][LIB].AtomicReact.onLoad()
        });
    });

    window.dispatchEvent(new CustomEvent(this[ATOMIC_REACT].lib.AtomicReact.AtomicEvents.LOADED))
}

