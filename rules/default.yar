rule Talal_EICAR_Training_Marker {
 meta:
  description = "Training marker only; not a general malware detector"
 strings:
  $marker = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
 condition:
  $marker
}

