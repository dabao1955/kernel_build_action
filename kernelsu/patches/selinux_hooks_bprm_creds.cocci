// Usually in `security/selinux/hooks.c`
@ selinux_hooks_bprm_creds @
identifier nnp, nosuid;
@@

  int nnp = (bprm->unsafe & LSM_UNSAFE_NO_NEW_PRIVS);
+ #ifdef CONFIG_KSU
+ static u32 ksu_sid;
+ char *secdata;
+ #endif

  if (!nnp && !nosuid) {
+   #ifdef CONFIG_KSU
+   int error;
+   u32 seclen;
+   #endif
    ...
  }

@ selinux_hooks_return @
@@
if (new_tsec->sid == old_tsec->sid)
  return 0; /* No change in credentials */
+ 
+ #ifdef CONFIG_KSU
+ if (!ksu_sid)
+     security_secctx_to_secid("u:r:su:s0", strlen("u:r:su:s0"), &ksu_sid);
+ 
+ error = security_secid_to_secctx(old_tsec->sid, &secdata, &seclen);
+ if (!error) {
+     rc = strcmp("u:r:init:s0", secdata);
+     security_release_secctx(secdata, seclen);
+     if (rc == 0 && new_tsec->sid == ksu_sid)
+         return 0;
+ }
+ #endif
