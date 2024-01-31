#!/bin/bash

set -eu

if [ -f /usr/bin/ccache ]; then
   export USE_CCACHE=0
fi


if [ -d $HOME/clang ]; then
    $HOME/clang/bin/clang --version
else
    $HOME/gcc-64/bin/aarch64-linux-android-gcc --version
fi
