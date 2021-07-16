import {Observable} from "rxjs";
import {Session} from "../speechrecorder/session/session";
import {ProjectService} from "../speechrecorder/project/project.service";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";
import {UUID} from "../utils/utils";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Inject} from "@angular/core";

export class Selection{
    position:number=0;
    length?:number;
}
export enum OrderDirection { ASC='ASC',DESC='DESC'}

export class Order{
    constructor(private _orderBy:string, private _orderDirection:OrderDirection=OrderDirection.ASC) {}
    get orderBy(): string {
        return this._orderBy;
    }
    get orderDirection(): OrderDirection {
        return this._orderDirection;
    }
}

export class BasicService<T> {

    protected apiEndPoint='';
    protected withCredentials:boolean=false;

    constructor(protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {

        if(config && config.apiEndPoint) {
            this.apiEndPoint=config.apiEndPoint;
        }
        if(this.apiEndPoint !== ''){
            this.apiEndPoint=this.apiEndPoint+'/'
        }
        if(config!=null && config.withCredentials!=null){
            this.withCredentials=config.withCredentials;
        }
    }

    protected appendRequestUUIDForDevelopmentServer(url:string,appendListSuffix:boolean=false):string{
        let resUrl=url;
        if (this.config && this.config.apiType === ApiType.FILES) {
            // for development and demo
            // append UUID to make request URL unique to avoid localhost server caching
            if(appendListSuffix){
                resUrl=resUrl+'_list';
            }
            resUrl = resUrl + '.json?requestUUID='+UUID.generate();
        }
        return resUrl
    }

  entityObserver(url: string): Observable<T> {
    let durl=this.appendRequestUUIDForDevelopmentServer(url);
    return this.http.get<T>(durl, {withCredentials: this.withCredentials});
  }

    listObserver(url: string, selection?:Selection|null,order?:Order): Observable<Array<T>> {

        let durl=this.appendRequestUUIDForDevelopmentServer(url,true);
        let params = new HttpParams();
        if(selection){
            params=params.set('_position',selection.position);
            if(selection.length!==undefined) {
                params = params.set('_length', selection.length);
            }
        }
        if (order) {
            params = params.set('_order-by', order.orderBy);
            // let od = 'ASC';
            // if (OrderDirection.DESC=== order.orderDirection) {
            //     od = 'DESC';
            // }
            params = params.set('_order-direction', order.orderDirection);
        }
        return this.http.get<Array<T>>(durl, {params: params, withCredentials: this.withCredentials});
    }

}
