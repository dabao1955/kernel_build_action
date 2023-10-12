#!/bin/bash

set -eu

if [ -f /usr/bin/ccache ]; then
   export USE_CCACHE=0
fi

if [ -d out ]; then
   rm -rf out
else
   make ARCH=arm64 clean
   make ARCH=arm64 mrproper
fi

if [ -d $HOME/clang ]; then
    $HOME/clang/bin/clang --version
else
    $HOME/gcc-64/bin/aarch64-linux-android-gcc --version
fi
