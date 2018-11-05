#!/bin/sh ######################################################################
# Copyright (C) 2018 TypeFox and others.
#
# This program and the accompanying materials are made available under the
# terms of the Eclipse Public License v. 2.0 which is available at
# http://www.eclipse.org/legal/epl-2.0.
#
# This Source Code may also be made available under the following Secondary
# Licenses when the conditions for such availability set forth in the Eclipse
# Public License v. 2.0 are satisfied: GNU General Public License, version 2
# with the GNU Classpath Exception which is available at
# https://www.gnu.org/software/classpath/license.html.
#
# SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
################################################################################/
# Based on: https://github.com/Microsoft/vscode/blob/77f0e95307675c3936c05d641f72b8b32dc8e274/extensions/git/src/askpass.sh

"$THEIA_GIT_ASKPASS_NODE" "$THEIA_GIT_ASKPASS_MAIN" $*
