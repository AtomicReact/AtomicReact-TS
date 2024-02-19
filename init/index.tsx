import { AtomicReact, Atom } from "atomicreact-ts"

export class MyApp extends Atom<{prop: {myTitle: string}, sub: {myBtn: HTMLButtonElement}}> {

    public struct = () => (
        <div>
            <h3>{this.prop?.myTitle}</h3>
            <button sub={this.sub.myBtn} >My Button - click me and see the console</button>
        </div>
    )
    onRender(): void {
        this.sub.myBtn.onclick = () => {
            console.log("Nice! You clicked me")
        }
    }   
     
}

AtomicReact.onLoad = () => {
    console.log(`AtomicReact loaded! Rendering atoms...`)
    AtomicReact.renderElement((new MyApp({myTitle: "This is my APP"})), document.getElementById("app"))
}
