defCtxVal("loadCSS", function (css) {
    let style = document.querySelector(`style[for="${ATOMIC_REACT}"]`)
    if (!style) {
        style = document.createElement("style")
        style.setAttribute("for", ATOMIC_REACT)
        style.type = "text/css"
        document.head.appendChild(style)
    }

    style.innerHTML = css
})
