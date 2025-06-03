import {Directive, Inject, Injector, OnDestroy, OnInit, Renderer2, DOCUMENT} from "@angular/core";


@Directive()
export class FitToPageComponent implements OnInit,OnDestroy{
  protected fitToPageUtil:FitToPageUtil;
  constructor(injector:Injector) {
    this.fitToPageUtil=new FitToPageUtil(injector);
  }
  ngOnInit() {
    this.fitToPageUtil.init();
  }
  ngOnDestroy() {
    this.fitToPageUtil.destroy();
  }

}


export class FitToPageUtil {

    private htmlHeightSave!:string;
    private htmlMarginSave!:string;
    private htmlPaddingSave!:string;
    private bodyHeightSave!:string;
    private bodyMarginSave!:string;
    private bodyPaddingSave!:string;
    private d:Document;
    protected renderer:Renderer2

    constructor(injector:Injector) {
        this.d=injector.get(DOCUMENT);
        this.renderer=injector.get(Renderer2);
    }


    init() {
        // Set CSS for fit to screen mode

        // Alternatives
        // Requires CSS file added to app
        //
        // Angular omponent styles cannot be apllied to html and body element
        // Adding style sheet programmatically to document is hacky
        //

        // Save CSS properties set by the main application
        let htmlStyle = this.d.documentElement.style
        this.htmlHeightSave = htmlStyle.height
        this.htmlMarginSave = htmlStyle.margin
        this.htmlMarginSave = htmlStyle.padding
        let bodyStyle = this.d.body.style
        this.bodyHeightSave = bodyStyle.height
        this.bodyMarginSave = bodyStyle.margin
        this.bodyPaddingSave = bodyStyle.padding

        // Apply fit to page properties
        this.renderer.setStyle(this.d.documentElement, 'height', '100%')
        this.renderer.setStyle(this.d.documentElement, 'margin', '0');
        this.renderer.setStyle(this.d.documentElement, 'padding', '0');

        this.renderer.setStyle(this.d.body, 'height', '100%');
        this.renderer.setStyle(this.d.body, 'margin', '0');
        this.renderer.setStyle(this.d.body, 'padding', '0');

    }

    destroy(){

        // Restore main app html and body CSS properties

        this.renderer.setStyle(this.d.documentElement, 'height', this.htmlHeightSave)
        this.renderer.setStyle(this.d.documentElement, 'margin',this.htmlMarginSave);
        this.renderer.setStyle(this.d.documentElement, 'padding',this.htmlPaddingSave);

        this.renderer.setStyle(this.d.body, 'height', this.bodyHeightSave);
        this.renderer.setStyle(this.d.body, 'margin', this.bodyMarginSave);
        this.renderer.setStyle(this.d.body, 'padding', this.bodyPaddingSave);
    }

}
