#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
# This file is part of main.sh.
#
# Copyright (c) 2024 dabao1955
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
#
# shellcheck disable=SC2086,SC2001,SC2002,SC2003,SC2185,SC2144,SC2155,SC2046,SC2129,SC2045

set -e

if [ ${GITHUB_ACTIONS} = "true" ]; then
  echo "::group:: Cleaning up"
  docker rmi -f $(docker images -q)
  wget -q https://raw.githubusercontent.com/Homebrew/install/master/uninstall.sh && NONINTERACTIVE=1 bash ./uninstall.sh -f -q
  echo "::endgroup::"

  echo "::group:: Setting Up Swap"
  export SWAP_FILE=$(swapon --show=NAME | tail -n 1)
  sudo swapoff "$SWAP_FILE"
  sudo rm "$SWAP_FILE"
  sudo fallocate -l 16G "$SWAP_FILE"
  sudo chmod 600 "$SWAP_FILE"
  sudo mkswap "$SWAP_FILE"
  sudo swapon "$SWAP_FILE"
  echo "::endgroup::"
fi

echo "::group:: Installing Building Depend Packages"
sudo apt-get update
sudo apt-get install --no-install-recommends -y binutils binutils-aarch64-linux-gnu binutils-arm-linux-gnueabi git ccache automake flex lzop bison gperf build-essential zip curl zlib1g-dev g++-multilib libxml2-utils bzip2 libbz2-dev libbz2-1.0 libghc-bzlib-dev squashfs-tools pngcrush schedtool dpkg-dev liblz4-tool make optipng maven libssl-dev pwgen libswitch-perl policycoreutils minicom libxml-sax-base-perl libxml-simple-perl bc libc6-dev-i386 lib32ncurses5-dev libx11-dev lib32z-dev libgl1-mesa-dev xsltproc unzip device-tree-compiler python3 aria2
echo "::endgroup::"

if [ "$AOSP_GCC" = true ]; then
  echo "::group:: Downloading AOSP GCC"
  if [ "$AOSP_CLANG" = true ]; then
    mkdir -p -v "$HOME"/gcc-64
    aria2c -o gcc-aarch64.tar.gz https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/aarch64/aarch64-linux-android-4.9/+archive/refs/tags/android-12.1.0_r27.tar.gz
    tar -C "$HOME"/gcc-64 -zxf gcc-aarch64.tar.gz
    mkdir -p -v "$HOME"/gcc-32
    aria2c -o gcc-arm.tar.gz https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/arm/arm-linux-androideabi-4.9/+archive/refs/tags/android-12.1.0_r27.tar.gz
    tar -C "$HOME"/gcc-32 -zxf gcc-arm.tar.gz
  else
    git clone https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/aarch64/aarch64-linux-android-4.9/ --depth=1 -b android"$ANDROID_VERSION"-release "$HOME"/gcc-64
    git clone https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/arm/arm-linux-androideabi-4.9/ --depth=1 -b android"$ANDROID_VERSION"-release "$HOME"/gcc-32
  fi
  echo "::endgroup::"
fi

if [ "$OTHER_CLANG" = true ]; then
  if [ "$AOSP_CLANG" = true ]; then
    echo "please disable aosp-clang to use 3rd clang."
    exit 1
  else
    echo "::group:: Downloading 3rd clang"
    git clone "$OTHER_CLANG_URL" -b "$OTHER_CLANG_BRANCH" "$HOME"/clang --depth="$DEPTH"
  fi
fi
echo "::endgroup::"

if [ "$ANDROID_NDK" = true ]; then
  echo "::group:: Downloading Android NDK"
  if [ "$AOSP_GCC" = false ]; then
    if [ "$ANDROID_NDK_X64" = false ]; then
      aria2c -o android-ndk.zip https://dl.google.com/android/repository/android-ndk-"$ANDROID_NDK_VERSION"-linux.zip
      unzip -d "$HOME" android-ndk.zip
    else
      aria2c -o android-ndk.zip https://dl.google.com/android/repository/android-ndk-"$ANDROID_NDK_VERSION"-linux-x86_64.zip
      unzip -d "$HOME" android-ndk.zip
    fi
  else
    echo "Please disable aosp-gcc and aosp-clang."
    exit 127
  fi
  echo "::endgroup::"

  export HOMES=$(pwd)
  export LLVMS="$HOME"/android-ndk-"$ANDROID_NDK_VERSION"/toolchains/llvm/prebuilt/linux-x86_64/bin
  cd $LLVMS
  for file in $(ls llvm-*); do
    ln -s -v "$file" "aarch64-linux-android$(("$ANDROID_VERSION" + 19))-${file#llvm-}"
  done
  cd "$HOMES"
fi

if [ "$PYTHON27" = true ]; then
  echo "::group:: Installing Python2.7 instead Python3"
  sudo apt-get install -y python2.7 python2.7-minimal
  test -f /bin/python && sudo rm -v /bin/python
  test -f /bin/python || sudo ln -v -s /bin/python2.7 /bin/python
  test -f /bin/python2 || sudo ln -v -s /bin/python2.7 /bin/python2
  echo "::endgroup::"
fi

if [ "$AOSP_CLANG" = true ]; then
  echo "::group:: Downloading AOSP clang"
  if [ "$AOSP_GCC" = true ]; then
    mkdir "$HOME"/clang -p -v
    aria2c -o aosp-clang.tar.gz https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+archive/refs/heads/android"$ANDROID_VERSION"-release/clang-"$AOSP_CLANG_VERSION".tar.gz
    tar -C "$HOME"/clang -zxf aosp-clang.tar.gz
  else
    echo "Please enable aosp-gcc."
    exit 127
  fi
  echo "::endgroup::"
fi

echo "::group:: Pulling Kernel Source"
mkdir -p -v kernel
git clone --recursive "$KERNEL_URL" -b "$BRANCH" --depth="$DEPTH" kernel/"$KERNEL_DIR"
echo "::endgroup::"

if [ "$VENDOR" = true ]; then
  echo "::group:: <<<Pulling Kernel vendor source"
  git clone "$VENDOR_URL" --depth="$DEPTH" kernel/"$VENDOR_DIR"
  test -d kernel/"$VENDOR_DIR"/vendor && cp -rv kernel/"$VENDOR_DIR"/vendor kernel
  test -d kernel/"$VENDOR_DIR"/vendor && cp -rv kernel/"$VENDOR_DIR"/vendor ./
  echo "::endgroup::"
fi

if [ "$KSU" = true ]; then
  echo "::group:: Initializing KernelSU"
  cd kernel/"$KERNEL_DIR"
  if [ -f KernelSU/kernel/Kconfig ]; then
    echo "KernelSU has been initialized,skipped."
  else
    curl -LSs "https://raw.githubusercontent.com/tiann/KernelSU/main/kernel/setup.sh" | bash -s "$KSU_VERSION"
  fi
  if grep -q "CONFIG_KPROBES=y" "arch/$ARCH/configs/$CONFIG"; then
    echo "KPROBES enabled,skip patch."
  else
    if cat fs/open.c | grep -i ksu >/dev/null; then
      echo "patched,skip patch"
    else
      if cat fs/open.c | grep -i do_faccessat >/dev/null; then
        echo Kernel SUBLEVEL is $(cat Makefile | grep "PATCHLEVEL =" | awk '{print $3}')
      else
        wget https://github.com/dabao1955/kernel_build_action/raw/main/patchs/KernelSU-4.9-faccessat-hook.patch
        git apply KernelSU-4.9-faccessat-hook.patch
      fi
      if grep -q "CONFIG_OPLUS_KERNEL_SECURE_GUARD" fs/exec.c; then
        wget https://github.com/dabao1955/kernel_build_action/raw/main/patchs/KernelSU-hook-OPLUS.patch
        git apply KernelSU-hook-OPLUS.patch
      else
        wget https://github.com/dabao1955/kernel_build_action/raw/main/patchs/KernelSU-hook.patch
        git apply KernelSU-hook.patch
      fi
    fi
  fi
  echo "::endgroup::"
fi

if [ "$NETHUNTER" = true ]; then
  echo "::group:: Initializing Kali nethunter"
  wget https://github.com/Biohazardousrom/Kali-defconfig-checker/raw/master/check-kernel-config
  bash check-kernel-config "$CONFIG" -w
  if [ "$NETHUNTER_PATCH" = true ]; then
    wget https://github.com/tomxi1997/kali-nethunter_patches/raw/main/add-wifi-injection.patch
    git apply add-wifi-injection.patch
    wget https://github.com/tomxi1997/kali-nethunter_patches/raw/main/fix-ath9k-naming-conflict.patch
    git apply fix-ath9k-naming-conflict.patch
  else
    echo "skip patch"
  fi
  echo "::endgroup::"
fi

if [ "$DISABLE_LTO" = true ]; then
  if grep -q "LTO" "arch/$ARCH/configs/$CONFIG"; then
    sed -i 's/CONFIG_LTO=y/CONFIG_LTO=n/' arch/"$ARCH"/configs/"$CONFIG"
    sed -i 's/CONFIG_LTO_CLANG=y/CONFIG_LTO_CLANG=n/' arch/"$ARCH"/configs/"$CONFIG"
    sed -i 's/CONFIG_THINLTO=y/CONFIG_THINLTO=n/' arch/"$ARCH"/configs/"$CONFIG"
    echo "CONFIG_LTO_NONE=y" >>arch/"$ARCH"/configs/"$CONFIG"
  fi
fi

if [ "$OVERLAYFS" = true ]; then
  grep -q "OVERLAY_FS" "arch/$ARCH/configs/$CONFIG" || echo "CONFIG_OVERLAY_FS=y" >>arch/"$ARCH"/configs/"$CONFIG"
fi

if [ "$KVM" = true ]; then
  echo "CONFIG_VIRTUALIZATION=y" >>arch/"$ARCH"/configs/"$CONFIG"
  echo "CONFIG_KVM=y" >>arch/"$ARCH"/configs/"$CONFIG"
  echo "CONFIG_KVM_MMIO=y" >>arch/"$ARCH"/configs/"$CONFIG"
  echo "CONFIG_KVM_ARM_HOST=y" >>arch/"$ARCH"/configs/"$CONFIG"
fi

if [ "$LXC" = true ]; then
  echo "::group:: Enabling LXC"
  wget https://github.com/wu17481748/lxc-docker/raw/main/LXC-DOCKER-OPEN-CONFIG.sh
  bash LXC-DOCKER-OPEN-CONFIG.sh "$CONFIG" -w
  grep -q "CONFIG_ANDROID_PARANOID_NETWORK" "arch/$ARCH/configs/$CONFIG" && sed -i 's/CONFIG_ANDROID_PARANOID_NETWORK=y/#CONFIG_ANDROID_PARANOID_NETWORK=y/' arch/"$ARCH"/configs/"$CONFIG"
  if [ "$LXC_PATCH" = true ]; then
    wget https://github.com/wu17481748/lxc-docker/raw/main/cgroup.patch
    patch kernel/cgroup/cgroup.c <cgroup.patch
    wget https://github.com/wu17481748/lxc-docker/raw/main/xt_qtaguid.patch
    patch net/netfilter/xt_qtaguid.c <xt_qtaguid.patch
  else
    echo skip lxc patch
  fi
  echo "::endgroup::"
fi

export A=$(date +%s)
mkdir out -p -v
if [ "$AOSP_CLANG" = true ]; then
  echo "::group:: Building Kernel"
  export CLANG_PATH="$HOME"/clang
  export PATH="$CLANG_PATH"/bin:"$PATH"
  make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC=clang ARCH="$ARCH" O=out "$CONFIG"
  if [ "$CCACHE" = true ]; then
    export USE_CCACHE=1
    make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC="ccache clang" ARCH="$ARCH" O=out "$EXTRA_CMD"
  else
    make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC=clang ARCH="$ARCH" O=out "$EXTRA_CMD"
  fi
  echo "::endgroup::"
elif [ "$ANDROID_NDK" = true ]; then
  echo "::group:: Building Kernel with Android NDK"
  export CLANG_PATH="$HOME"/android-ndk-"$ANDROID_NDK_VERSION"/toolchains/llvm/prebuilt/linux-x86_64
  export PATH="$CLANG_PATH"/bin:"$PATH"
  make -j$(nproc --all) CROSS_COMPILE="$CLANG_PATH"/bin/llvm- COMPILE_ARM32="$CLANG_PATH"/bin/llvm- CLANG_TRIPLE=aarch64-linux-android$(("$ANDROID_VERSION" + 19))- CC=clang ARCH="$ARCH" O=out "$CONFIG"
  if [ "$CCACHE" = true ]; then
    export USE_CCACHE=1
    make -j$(nproc --all) CROSS_COMPILE="$CLANG_PATH"/bin/llvm- COMPILE_ARM32="$CLANG_PATH"/bin/llvm- CLANG_TRIPLE=aarch64-linux-android$(("$ANDROID_VERSION" + 19))- CC="ccache clang" ARCH="$ARCH" O=out "$EXTRA_CMD"
  else
    make -j$(nproc --all) CROSS_COMPILE="$CLANG_PATH"/bin/llvm- COMPILE_ARM32="$CLANG_PATH"/bin/llvm- CLANG_TRIPLE=aarch64-linux-android$(("$ANDROID_VERSION" + 19))- CC=clang ARCH="$ARCH" O=out "$EXTRA_CMD"
  fi
  echo "::endgroup::"
elif [ "$OTHER_CLANG" = true ]; then
  echo "::group:: Building Kernel"
  export CLANG_PATH="$HOME"/clang
  export PATH="$CLANG_PATH"/bin:$PATH
  make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC=clang ARCH="$ARCH" O=out "$CONFIG"
  if [ "$CCACHE" = true ]; then
    export USE_CCACHE=1
    make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC="ccache clang" ARCH="$ARCH" O=out "$EXTRA_CMD"
  else
    make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- CLANG_TRIPLE=aarch64-linux-gnu- CC=clang ARCH="$ARCH" O=out "$EXTRA_CMD"
  fi
elif [ "$AOSP_GCC" = true ]; then
  echo "::group:: Building Kernel use GCC"
  make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- ARCH="$ARCH" O=out "$CONFIG"
  make -j$(nproc --all) CROSS_COMPILE="$HOME"/gcc-64/bin/aarch64-linux-android- COMPILE_ARM32="$HOME"/gcc-32/bin/arm-linux-androideabi- ARCH="$ARCH" O=out "$EXTRA_CMD"
  echo "::endgroup::"
  echo "::endgroup::"
fi

export B=$(date +%s)
export C=$(expr $B - $A)
export buildtime=$(date) >>$GITHUB_ENV
export dconfig="$CONFIG" >>$GITHUB_ENV
export USETIME=$(expr $C / 60)min$(expr $C % 60)s

if [ "$ANYKERNEL3" = false ]; then
  echo "::group:: Preparing to Upload boot.img"
  git clone https://github.com/Shubhamvis98/AIK
  wget "$BOOTIMG_URL" -O boot.img
  cd AIK
  nohup bash unpackimg ../boot.img
  cat nohup.out | grep "KERNEL_FMT" | awk '{gsub("\\[", "", $2); gsub("\\]", "", $2); print $2}' >>fmt.txt
  export FMT=$(cat fmt.txt)
  if [ "$FMT" = "gzip" ]; then
    if find -name "*dtb"; then
      if ls ../out/arch/"$ARCH"/boot/Image.gz-dtb; then
        cp -v ../out/arch/"$ARCH"/boot/Image.gz-dtb split/kernel -v
      else
        cp -v ../out/arch/"$ARCH"/boot/Image.gz-dtb split/kernel -v
      fi
    else
      cp -v ../out/arch/"$ARCH"/boot/Image.gz split/kernel -v
    fi
  elif [ "$FMT" = "raw" ]; then
    cp -v ../out/arch/"$ARCH"/boot/Image split/kernel -v
  fi
  bash repackimg
  mkdir -p -v ../build
  mv boot-new.img ../build/boot.img -v
  echo "::endgroup::"
else
  echo "::group:: Packaging Anykernel3 flasher"
  git clone https://github.com/osm0sis/AnyKernel3
  sed -i 's!block=/dev/block/platform/omap/omap_hsmmc.0/by-name/boot;!block=auto;!g' AnyKernel3/anykernel.sh
  sed -i 's/do.devicecheck=1/do.devicecheck=0/g' AnyKernel3/anykernel.sh
  sed -i 's/is_slot_device=0;/is_slot_device=auto;/g' AnyKernel3/anykernel.sh

  if [ -f out/arch/"$ARCH"/boot/Image.*-dtb ]; then
    cp out/arch/"$ARCH"/boot/Image.*-dtb AnyKernel3/ -rv
  elif [ -f out/arch/"$ARCH"/boot/Image.* ]; then
    cp out/arch/"$ARCH"/boot/Image.* AnyKernel3/ -rv
  else
    cp out/arch/"$ARCH"/boot/Image AnyKernel3/ -rv
  fi

  test -f out/arch/"$ARCH"/boot/dtbo.img && cp -v out/arch/"$ARCH"/boot/dtbo.img AnyKernel3/

  rm -rf -v AnyKernel3/.git* AnyKernel3/README.md
  if [ "$RELEASE" = false ]; then
    cp AnyKernel3 ../../build -r -v
  else
    zip Anykernel3-flasher.zip Anykernel3/*
    mv Anykernel3-flasher.zip ../../build -rv
  fi
  echo "::endgroup::"
fi
