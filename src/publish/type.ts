import {Options} from "amqplib";
import {Config} from "../config";

export type PublishOptions = {
    /**
     * Config key or object.
     */
    alias?: string | Config;

    /**
     * Amqplib publish options.
     */
    options?: Options.Publish;
}
