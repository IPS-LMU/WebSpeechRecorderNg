import {Directive, Inject, Injector, OnDestroy, OnInit, Renderer2} from "@angular/core";
import {DOCUMENT} from "@angular/common";


export class HighlighterUtil {

    private htmlFilterSave!:string;
    private htmlOpacitySave!:string;

    private d:Document;
    protected renderer:Renderer2

    constructor(injector:Injector) {
        this.d=injector.get(DOCUMENT);
        this.renderer=injector.get(Renderer2);
    }



    blur(blur:boolean) {

        if(blur) {
            let htmlStyle = this.d.documentElement.style
            let bodyStyle = this.d.body.style

            this.htmlFilterSave = htmlStyle.filter
            this.htmlOpacitySave=htmlStyle.opacity;

            // Apply fit to page properties
            this.renderer.setStyle(this.d.documentElement, 'filter', 'blur(2px)')
            this.renderer.setStyle(this.d.documentElement, 'opacity', '50%')
            //this.renderer.setStyle(this.d.body, 'background', 'darkgrey')
        }else{
            this.destroy();
        }
    }

    destroy(){

        // Restore main app html and body CSS properties
        this.renderer.setStyle(this.d.documentElement, 'filter', this.htmlFilterSave)
        this.renderer.setStyle(this.d.documentElement, 'opacity', this.htmlOpacitySave)

    }

}
