obj-$(CONFIG_REKERNEL) += rekernel.o

KDIR ?= /lib/modules/$(shell uname -r)/build
PWD := $(shell pwd)

all:
	make -C $(KDIR) M=$(PWD) modules $(if $(V),V=$(V))

clean:
	make -C $(KDIR) M=$(PWD) clean $(if $(V),V=$(V))
