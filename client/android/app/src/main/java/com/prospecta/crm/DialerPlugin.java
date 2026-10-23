package com.prospecta.crm;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Dialer",
    permissions = @Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "phone")
)
public class DialerPlugin extends Plugin {

    private String pendingNumber = null;

    private boolean hasPhonePermission() {
        return getContext().checkSelfPermission(Manifest.permission.CALL_PHONE)
            == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasPhonePermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasPhonePermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        pendingNumber = null;
        requestPermissionForAlias("phone", call, "permissionResult");
    }

    @PluginMethod
    public void startCall(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.trim().isEmpty()) {
            call.reject("Número de telefone vazio");
            return;
        }
        if (hasPhonePermission()) {
            placeCall(call, number.trim());
        } else {
            pendingNumber = number.trim();
            requestPermissionForAlias("phone", call, "permissionResult");
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        String number = pendingNumber;
        pendingNumber = null;

        if (number != null) {
            if (hasPhonePermission()) {
                placeCall(call, number);
            } else {
                JSObject ret = openDialer(number);
                if (ret != null) {
                    ret.put("mode", "dialer");
                    call.resolve(ret);
                } else {
                    call.reject("Permissão negada e discador indisponível");
                }
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", hasPhonePermission());
            call.resolve(ret);
        }
    }

    private void placeCall(PluginCall call, String number) {
        try {
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + number));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("mode", "auto");
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = openDialer(number);
            if (ret != null) {
                ret.put("mode", "dialer");
                call.resolve(ret);
            } else {
                call.reject("Falha ao discar: " + e.getMessage());
            }
        }
    }

    private JSObject openDialer(String number) {
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            return ret;
        } catch (Exception e) {
            return null;
        }
    }
}
