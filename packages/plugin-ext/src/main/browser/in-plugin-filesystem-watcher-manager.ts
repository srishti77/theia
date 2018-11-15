/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { interfaces } from 'inversify';
import { FileSystemWatcher, FileChangeEvent, FileChangeType, FileChange } from '@theia/filesystem/lib/browser/filesystem-watcher';
import { WorkspaceExt } from '../../api/plugin-api';
import { FileWatcherSubscriberOptions } from '../../api/model';
import { parse, ParsedPattern, IRelativePattern } from '../../common/glob';
import { RelativePattern } from '../../plugin/types-impl';

export class InPluginFileSystemWatcherManager {

    private proxy: WorkspaceExt;
    private subscribers: Map<string, FileWatcherSubscriber>;
    private nextSubscriberId: number;

    constructor(proxy: WorkspaceExt, container: interfaces.Container) {
        this.proxy = proxy;
        this.subscribers = new Map<string, FileWatcherSubscriber>();
        this.nextSubscriberId = 0;

        const fileSystemWatcher = container.get(FileSystemWatcher);
        fileSystemWatcher.onFilesChanged(event => this.onFilesChangedEventHandler(event));
    }

    // Filter file system changes according to subscribers settings here to avoid unneeded traffic.
    onFilesChangedEventHandler(changes: FileChangeEvent): void {
        console.log('>>>> THEIA: native FS event was trigerred'); // TODO del
        for (const change of changes) {
            console.log('>>', change.type, change.uri.toString()); // TODO del
            switch (change.type) {
                case FileChangeType.UPDATED:
                    for (const [id, subscriber] of this.subscribers) {
                        if (!subscriber.ignoreChangeEvents && this.uriMatches(subscriber, change)) {
                            this.proxy.$fileChanged({ subscriberId: id, uri: change.uri.toString(), type: 'updated' });
                        }
                    }
                    break;
                case FileChangeType.ADDED:
                    for (const [id, subscriber] of this.subscribers) {
                        if (!subscriber.ignoreCreateEvents && this.uriMatches(subscriber, change)) {
                            this.proxy.$fileChanged({ subscriberId: id, uri: change.uri.toString(), type: 'created' });
                        }
                    }
                    break;
                case FileChangeType.DELETED:
                    for (const [id, subscriber] of this.subscribers) {
                        if (!subscriber.ignoreDeleteEvents && this.uriMatches(subscriber, change)) {
                            this.proxy.$fileChanged({ subscriberId: id, uri: change.uri.toString(), type: 'deleted' });
                        }
                    }
                    break;
            }
        }
    }

    private uriMatches(subscriber: FileWatcherSubscriber, fileChange: FileChange): boolean {
        return subscriber.mather(fileChange.uri.path.toString());
    }

    registerFileWatchSubscription(options: FileWatcherSubscriberOptions): string {
        const subscriberId = this.getNextId();
        // const disposeble = this.fileSystemWatcher.watchFileChanges(); // TODO is needed ?

        let globPatternMatcher: ParsedPattern;
        if (typeof options.globPattern === 'string') {
            globPatternMatcher = parse(options.globPattern);
        } else {
            const relativePattern: IRelativePattern = new RelativePattern(options.globPattern.base, options.globPattern.pattern);
            globPatternMatcher = parse(relativePattern);
        }

        const subscriber: FileWatcherSubscriber = {
            id: subscriberId,
            mather: globPatternMatcher,
            ignoreCreateEvents: options.ignoreCreateEvents === true,
            ignoreChangeEvents: options.ignoreChangeEvents === true,
            ignoreDeleteEvents: options.ignoreDeleteEvents === true
        };
        this.subscribers.set(subscriberId, subscriber);

        return subscriberId;
    }

    unregisterFileWatchSubscription(subscriptionId: string): void {
        this.subscribers.delete(subscriptionId);
    }

    private getNextId(): string {
        return 'ipfsw' + this.nextSubscriberId++;
    }

}

interface FileWatcherSubscriber {
    id: string;
    mather: ParsedPattern;
    ignoreCreateEvents: boolean;
    ignoreChangeEvents: boolean;
    ignoreDeleteEvents: boolean;
}
