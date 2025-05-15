# How to use

1) Install [Coccinelle](https://coccinelle.gitlabpages.inria.fr/website/download.html)
2) Run these commands from a Linux shell:
  ```sh
  spatch --sp-file input_handle_event.cocci --in-place --linux-spacing /path-to-kernel/drivers/input/input.c
  find . -iname '*.cocci' | xargs -I{} -P0 spatch --sp-file {} --dir /path-to-kernel/fs --in-place --linux-spacing
  ```
  
  For example in my case my kernel source location is `~/dev/kernel_xiaomi_sm6150` so I run these commands:
  
  ```sh
  spatch --sp-file input_handle_event.cocci --in-place --linux-spacing ~/dev/kernel_xiaomi_sm6150/drivers/input/input.c
  find . -iname '*.cocci' | xargs -I{} -P0 spatch --sp-file {} --dir ~/dev/kernel_xiaomi_sm6150/fs --in-place --linux-spacing
  ```
