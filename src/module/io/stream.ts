
export interface Float32OutStream{

    write(buffers:Array<Float32Array>):number;
    flush();
    close();
}