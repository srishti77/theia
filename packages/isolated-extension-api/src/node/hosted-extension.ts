/*
 * Copyright (C) 2015-2018 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */
import * as path from 'path';
import * as cp from "child_process";
import { injectable, inject } from "inversify";
import { Extension, HostedExtensionClient } from '../common/extension-protocol';
import { ILogger, ConnectionErrorHandler } from "@theia/core/lib/common";
import { Emitter } from '@theia/core/lib/common/event';
import { createIpcEnv } from "@theia/core/lib/node/messaging/ipc-protocol";
import { MAIN_RPC_CONTEXT } from '../api/extension-api';
import { RPCProtocolImpl } from '../api/rpc-protocol';

export interface IPCConnectionOptions {
    readonly serverName: string;
    readonly logger: ILogger;
    readonly args: string[];
    readonly errorHandler?: ConnectionErrorHandler;
}

@injectable()
export class HostedExtensionSupport {
    private client: HostedExtensionClient;

    @inject(ILogger)
    protected readonly logger: ILogger;
    private cp: cp.ChildProcess | undefined;

    constructor() {

    }

    setClient(client: HostedExtensionClient): void {
        this.client = client;
    }

    runExtension(extension: Extension): void {
        if (extension.theiaExtension.node) {
            this.runExtServer(extension);
        }
    }

    onMessage(message: string): void {
        if (this.cp) {
            this.cp.send(message);
        }
    }

    clientClosed(): void {
        if (this.cp) {
            this.terminatePluginServer(this.cp);
            this.cp = undefined;
        }
    }

    private terminatePluginServer(cp: cp.ChildProcess) {
        const emmitter = new Emitter();
        cp.on('message', message => {
            emmitter.fire(JSON.parse(message));
        });
        const rpc = new RPCProtocolImpl({
            onMessage: emmitter.event,
            send: (m: {}) => {
                if (cp.send) {
                    cp.send(JSON.stringify(m));
                }
            }
        });
        const hostedExtManager = rpc.getProxy(MAIN_RPC_CONTEXT.HOSTED_EXTENSION_MANAGER_EXT);
        hostedExtManager.stopExtensions().then(() => {
            cp.kill();
        });
    }

    private runExtServer(extension: Extension): void {
        if (this.cp) {
            this.terminatePluginServer(this.cp);
        }
        this.cp = this.fork({
            serverName: "hosted-extension",
            logger: this.logger,
            args: []
        });
        this.cp.on('message', message => {
            if (this.client) {
                this.client.postMessage(message);
            }
        });

    }

    private fork(options: IPCConnectionOptions): cp.ChildProcess {
        const forkOptions: cp.ForkOptions = {
            silent: true,
            env: createIpcEnv(),
            execArgv: [],
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        };
        const inspectArgPrefix = `--${options.serverName}-inspect`;
        const inspectArg = process.argv.find(v => v.startsWith(inspectArgPrefix));
        if (inspectArg !== undefined) {
            forkOptions.execArgv = ['--nolazy', `--inspect${inspectArg.substr(inspectArgPrefix.length)}`];
        }

        const childProcess = cp.fork(path.resolve(__dirname, 'extension-host.js'), options.args, forkOptions);
        childProcess.stdout.on('data', data => this.logger.info(`[${options.serverName}: ${childProcess.pid}] ${data.toString()}`));
        childProcess.stderr.on('data', data => this.logger.error(`[${options.serverName}: ${childProcess.pid}] ${data.toString()}`));

        this.logger.debug(`[${options.serverName}: ${childProcess.pid}] IPC started`);
        childProcess.once('exit', () => this.logger.debug(`[${options.serverName}: ${childProcess.pid}] IPC exited`));

        return childProcess;
    }
}
