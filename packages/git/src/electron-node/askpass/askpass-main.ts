/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Based on: https://github.com/Microsoft/vscode/blob/dd3e2d94f81139f9d18ba15a24c16c6061880b93/extensions/git/src/askpass-main.ts.

import * as url from 'url';
import * as http from 'http';

// tslint:disable-next-line:no-any
function fatal(err: any): void {
    console.error('Missing or invalid credentials.');
    console.error(err);
    process.exit(1);
}

// 1. Node.js executable path. In this particular case it is Electron.
// 2. The location of the corresponding JS file of the current (`__filename`) file.
// 3. `Username`/`Password`.
// 4. `for`.
// 5. The host. For example: `https://github.com`.
const expectedArgvCount = 5;

function main(argv: string[]): void {

    if (argv.length !== expectedArgvCount) {
        return fatal(`Wrong number of arguments. Expected ${expectedArgvCount}. Got ${argv.length} instead.`);
    }

    if (!process.env['THEIA_GIT_ASKPASS_HANDLE']) {
        return fatal("Missing 'THEIA_GIT_ASKPASS_HANDLE' handle.");
    }

    const handle = process.env['THEIA_GIT_ASKPASS_HANDLE'] as string;
    const { host, hostname, port, protocol } = url.parse(handle);
    const gitRequest = argv[2];
    const gitHost = argv[4].substring(1, argv[4].length - 2);

    const opts: http.RequestOptions = {
        host,
        hostname,
        port,
        protocol,
        path: '/',
        method: 'POST'
    };

    const req = http.request(opts, res => {
        if (res.statusCode !== 200) {
            return fatal(`Bad status code: ${res.statusCode}.`);
        }

        const chunks: string[] = [];
        res.setEncoding('utf8');
        res.on('data', (d: string) => chunks.push(d));
        res.on('end', () => {
            const raw = chunks.join('');

            try {
                const result = JSON.parse(raw);
                process.stdout.write(result);
            } catch (err) {
                return fatal('Error parsing the response.');
            }

            setTimeout(() => process.exit(0), 0);
        });
    });

    req.on('error', err => fatal(err));
    req.write(JSON.stringify({ gitRequest, gitHost }));
    req.end();
}

main(process.argv);
